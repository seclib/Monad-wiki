import { VAULT_FOLDERS, VaultService } from '#services/vault_service'
import { VaultIntelligenceService } from '#services/vault_intelligence_service'
import type { VaultFolder } from '#services/vault_service'
import {
  vaultAskValidator,
  vaultIndexValidator,
  vaultSaveValidator,
  vaultSemanticSearchValidator,
} from '#validators/vault'
import type { HttpContext } from '@adonisjs/core/http'

export default class VaultController {
  private vaultService = new VaultService()
  private vaultIntelligenceService = new VaultIntelligenceService()

  async status({}: HttpContext) {
    return this.vaultService.status()
  }

  async save({ request, response }: HttpContext) {
    const payload = await request.validateUsing(vaultSaveValidator)
    const result = await this.vaultService.saveMarkdown({
      folder: payload.folder,
      title: payload.title,
      content: payload.content,
      tags: payload.tags ?? [],
      filename: payload.filename,
      metadata: payload.metadata as Record<string, string | number | boolean | null | undefined>,
    })

    return response.status(201).send(result)
  }

  async list({ request, response }: HttpContext) {
    const folder = String(request.qs().folder || '').trim()
    const limit = Number(request.qs().limit || 100)
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100

    if (folder && !VAULT_FOLDERS.includes(folder as VaultFolder)) {
      return response.status(422).send({
        message: `Invalid vault folder. Expected one of: ${VAULT_FOLDERS.join(', ')}`,
      })
    }

    return {
      files: await this.vaultService.list(folder ? (folder as VaultFolder) : undefined, safeLimit),
    }
  }

  async search({ request }: HttpContext) {
    const q = String(request.qs().q || '').trim()
    const limit = Number(request.qs().limit || 20)
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20
    return {
      results: await this.vaultService.search(q, safeLimit),
    }
  }

  async index({ request, response }: HttpContext) {
    const payload = await request.validateUsing(vaultIndexValidator)
    const status = await this.vaultIntelligenceService.syncIndex({
      embeddingModel: payload.embeddingModel,
      force: payload.force ?? false,
    })

    return response.status(202).send(status)
  }

  async indexStatus({ request }: HttpContext) {
    const embeddingModel = String(request.qs().embeddingModel || '').trim() || undefined
    return {
      index: await this.vaultIntelligenceService.getStatus(embeddingModel),
    }
  }

  async semanticSearch({ request, response }: HttpContext) {
    const payload = await request.validateUsing(vaultSemanticSearchValidator)

    try {
      return {
        mode: 'semantic',
        query: payload.query,
        results: await this.vaultIntelligenceService.semanticSearch(payload),
      }
    } catch (error) {
      const results = await this.vaultIntelligenceService.keywordFallback(
        payload.query,
        payload.limit ?? 20
      )

      return response.status(200).send({
        mode: 'keyword',
        query: payload.query,
        results,
        warning:
          error instanceof Error
            ? `Semantic search unavailable: ${error.message}`
            : 'Semantic search unavailable.',
      })
    }
  }

  async ask({ request, response }: HttpContext) {
    const payload = await request.validateUsing(vaultAskValidator)

    try {
      return await this.vaultIntelligenceService.ask({
        question: payload.question,
        chatModel: payload.model,
        embeddingModel: payload.embeddingModel,
        limit: payload.limit,
      })
    } catch (error) {
      return response.status(503).send({
        error: 'vault_ai_unavailable',
        message:
          'Vault AI retrieval is unavailable. Verify Ollama is running and an embedding/chat model is installed.',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
