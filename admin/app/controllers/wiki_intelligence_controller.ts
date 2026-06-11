import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { OllamaService } from '#services/ollama_service'
import { RagService } from '#services/rag_service'
import {
  semanticSearchSchema,
  wikiArticleQuerySchema,
  wikiAskSchema,
} from '#validators/wiki_intelligence'

type WikiContextResult = {
  text: string
  score: number
  metadata?: Record<string, any>
}

@inject()
export default class WikiIntelligenceController {
  constructor(
    private ragService: RagService,
    private ollamaService: OllamaService
  ) {}

  public async semanticSearch({ request, response }: HttpContext) {
    const payload = await request.validateUsing(semanticSearchSchema)
    const results = await this.ragService.searchSimilarDocuments(
      payload.query,
      payload.limit ?? 8,
      payload.scoreThreshold ?? 0.3
    )

    return response.status(200).json({
      query: payload.query,
      results: this.formatSources(results),
    })
  }

  public async ask({ request, response }: HttpContext) {
    const payload = await request.validateUsing(wikiAskSchema)
    const context = await this.ragService.searchSimilarDocuments(
      payload.question,
      payload.limit ?? 5,
      0.3
    )

    if (context.length === 0) {
      return response.status(200).json({
        question: payload.question,
        answer: null,
        sources: [],
        message: 'No indexed wiki context matched this question.',
      })
    }

    const model = await this.resolveChatModel(payload.model)
    const completion = await this.ollamaService.chat({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are Ask MONAD, an assistant for a local wiki. Answer using only the provided wiki context. If the context is insufficient, say what is missing. Cite article or section names when available.',
        },
        {
          role: 'user',
          content: `Question:\n${payload.question}\n\nWiki context:\n${this.buildContextBlock(context)}`,
        },
      ],
    })

    return response.status(200).json({
      question: payload.question,
      answer: completion.message.content,
      model,
      sources: this.formatSources(context),
    })
  }

  public async summarize({ request, response }: HttpContext) {
    const payload = await request.validateUsing(wikiArticleQuerySchema)
    const query = this.resolveArticleQuery(payload)
    if (!query) {
      return response.status(400).json({
        error: 'Provide at least one of articleTitle, query, or source.',
      })
    }

    const context = await this.ragService.searchSimilarDocuments(query, payload.limit ?? 6, 0.25)
    if (context.length === 0) {
      return response.status(404).json({
        query,
        summary: null,
        sources: [],
        message: 'No indexed wiki content found for this article query.',
      })
    }

    const model = await this.resolveChatModel(payload.model)
    const completion = await this.ollamaService.chat({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the provided MONAD wiki context. Be concise, factual, and preserve important names, warnings, commands, and procedures. Return markdown with: Summary, Key Points, and Suggested Tags.',
        },
        {
          role: 'user',
          content: `Article query:\n${query}\n\nWiki context:\n${this.buildContextBlock(context)}`,
        },
      ],
    })

    return response.status(200).json({
      query,
      summary: completion.message.content,
      model,
      sources: this.formatSources(context),
    })
  }

  public async related({ request, response }: HttpContext) {
    const payload = await request.validateUsing(wikiArticleQuerySchema)
    const query = this.resolveArticleQuery(payload)
    if (!query) {
      return response.status(400).json({
        error: 'Provide at least one of articleTitle, query, or source.',
      })
    }

    const results = await this.ragService.searchSimilarDocuments(
      query,
      (payload.limit ?? 6) * 3,
      0.25
    )
    const normalizedTarget = query.toLowerCase()
    const seen = new Set<string>()
    const articles = this.formatSources(results)
      .filter((item) => {
        const key = `${item.documentId || item.source || ''}:${item.articleTitle || item.title || ''}`
        const title = (item.articleTitle || item.title || '').toLowerCase()
        if (!key.trim() || seen.has(key) || title === normalizedTarget) return false
        seen.add(key)
        return true
      })
      .slice(0, payload.limit ?? 6)

    return response.status(200).json({
      query,
      articles,
    })
  }

  public async tags({ request, response }: HttpContext) {
    const payload = await request.validateUsing(wikiArticleQuerySchema)
    const query = this.resolveArticleQuery(payload)
    if (!query) {
      return response.status(400).json({
        error: 'Provide at least one of articleTitle, query, or source.',
      })
    }

    const context = await this.ragService.searchSimilarDocuments(query, payload.limit ?? 5, 0.25)
    if (context.length === 0) {
      return response.status(404).json({ query, tags: [], sources: [] })
    }

    const model = await this.resolveChatModel(payload.model)
    const completion = await this.ollamaService.chat({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Generate 5 to 8 concise wiki tags from the provided context. Return only a JSON array of lowercase tag strings.',
        },
        {
          role: 'user',
          content: `Article query:\n${query}\n\nWiki context:\n${this.buildContextBlock(context)}`,
        },
      ],
    })

    return response.status(200).json({
      query,
      tags: this.parseJsonTags(completion.message.content),
      raw: completion.message.content,
      model,
      sources: this.formatSources(context),
    })
  }

  private resolveArticleQuery(payload: {
    articleTitle?: string
    query?: string
    source?: string
  }): string | null {
    return payload.articleTitle || payload.query || payload.source || null
  }

  private buildContextBlock(results: WikiContextResult[]): string {
    return results
      .map((result, index) => {
        const metadata = result.metadata ?? {}
        const title = metadata.full_title || metadata.article_title || metadata.source || 'Untitled'
        return `[${index + 1}] ${title} (${Math.round(result.score * 100)}%)\n${result.text}`
      })
      .join('\n\n')
  }

  private formatSources(results: WikiContextResult[]) {
    return results.map((result) => {
      const metadata = result.metadata ?? {}
      return {
        title: metadata.full_title || metadata.article_title || metadata.source || 'Untitled',
        articleTitle: metadata.article_title ?? null,
        sectionTitle: metadata.section_title ?? null,
        documentId: metadata.document_id ?? null,
        source: metadata.source ?? null,
        contentType: metadata.content_type ?? null,
        score: result.score,
        preview: result.text.slice(0, 500),
      }
    })
  }

  private async resolveChatModel(requestedModel?: string): Promise<string> {
    if (requestedModel) return requestedModel

    const models = await this.ollamaService.getModels()
    const model = models.find((item) => !item.name.toLowerCase().includes('embed'))
    if (!model) {
      throw new Error('No chat model is installed. Install or configure an AI model first.')
    }
    return model.name
  }

  private parseJsonTags(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((tag): tag is string => typeof tag === 'string')
    } catch (error) {
      logger.debug(
        `[WikiIntelligence] Tag JSON parse failed: ${error instanceof Error ? error.message : error}`
      )
      return raw
        .split(/,|\n/)
        .map((tag) =>
          tag
            .replace(/["'\[\]-]/g, '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
        .slice(0, 8)
    }
  }
}
