import { EMBEDDING_MODEL_NAME } from '../../constants/ollama.js'
import { OllamaService } from '#services/ollama_service'
import { VaultSearchResult, VaultService } from '#services/vault_service'
import { mkdir } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { assertProjectReadPath, assertProjectWritePath } from '../utils/paths.js'
import { readEncryptedStorageFile, writeEncryptedStorageFile } from '../utils/storage_crypto.js'

type VaultIndexEntry = {
  id: string
  relativePath: string
  folder: string
  title: string
  tags: string[]
  chunkIndex: number
  text: string
  embedding: number[]
  sourceMtime: string
  sourceSize: number
}

type VaultVectorIndex = {
  version: 1
  embeddingModel: string
  updatedAt: string
  entries: VaultIndexEntry[]
}

export type VaultSemanticResult = {
  title: string
  relativePath: string
  folder: string
  snippet: string
  tags: string[]
  score: number
  chunkIndex: number
}

export type VaultIndexStatus = {
  indexedFiles: number
  indexedChunks: number
  embeddingModel: string
  updatedAt: string
  staleFiles: number
}

const INDEX_VERSION = 1 as const
const INDEX_DIRNAME = '.monad-index'
const INDEX_FILENAME = 'vectors.json'
const MAX_CHUNK_CHARS = 1800
const EMBED_BATCH_SIZE = 8

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*[\s\S]*?\n---\s*/, '').trim()
}

function chunkMarkdown(markdown: string): string[] {
  const clean = stripFrontmatter(markdown).replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const chunks: string[] = []
  let current = ''

  for (const part of clean.split(/\n{2,}/)) {
    const paragraph = part.trim()
    if (!paragraph) continue

    if (paragraph.length > MAX_CHUNK_CHARS) {
      if (current.trim()) {
        chunks.push(current.trim())
        current = ''
      }
      for (let index = 0; index < paragraph.length; index += MAX_CHUNK_CHARS) {
        chunks.push(paragraph.slice(index, index + MAX_CHUNK_CHARS).trim())
      }
      continue
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length > MAX_CHUNK_CHARS) {
      chunks.push(current.trim())
      current = paragraph
    } else {
      current = next
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    normA += a[index] * a[index]
    normB += b[index] * b[index]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function dedupeByFile(results: VaultSemanticResult[]) {
  const bestByPath = new Map<string, VaultSemanticResult>()

  for (const result of results) {
    const current = bestByPath.get(result.relativePath)
    if (!current || result.score > current.score) {
      bestByPath.set(result.relativePath, result)
    }
  }

  return Array.from(bestByPath.values()).sort((a, b) => b.score - a.score)
}

export class VaultIntelligenceService {
  private vaultService = new VaultService()
  private ollamaService = new OllamaService()

  async syncIndex(
    options: { embeddingModel?: string; force?: boolean } = {}
  ): Promise<VaultIndexStatus> {
    await this.vaultService.ensureVault()

    const embeddingModel = options.embeddingModel || EMBEDDING_MODEL_NAME
    const existing = options.force ? null : await this.readIndex(embeddingModel)
    const existingByFile = new Map<string, VaultIndexEntry[]>()

    for (const entry of existing?.entries ?? []) {
      const key = `${entry.relativePath}:${entry.sourceMtime}:${entry.sourceSize}`
      const entries = existingByFile.get(key) ?? []
      entries.push(entry)
      existingByFile.set(key, entries)
    }

    const files = await this.vaultService.list(undefined, 5000)
    const entries: VaultIndexEntry[] = []
    let staleFiles = 0

    for (const file of files) {
      const cacheKey = `${file.relativePath}:${file.updatedAt}:${file.sizeBytes}`
      const cached = existingByFile.get(cacheKey)
      if (cached) {
        entries.push(...cached)
        continue
      }

      staleFiles += 1
      const markdown = (
        await readEncryptedStorageFile(this.resolveVaultPath(file.relativePath))
      ).toString('utf8')
      const chunks = chunkMarkdown(markdown)
      if (chunks.length === 0) continue

      const embeddings = await this.embedChunks(embeddingModel, chunks)
      chunks.forEach((text, index) => {
        entries.push({
          id: `${file.relativePath}#${index}`,
          relativePath: file.relativePath,
          folder: file.folder,
          title: file.title,
          tags: file.tags,
          chunkIndex: index,
          text,
          embedding: embeddings[index],
          sourceMtime: file.updatedAt,
          sourceSize: file.sizeBytes,
        })
      })
    }

    const index: VaultVectorIndex = {
      version: INDEX_VERSION,
      embeddingModel,
      updatedAt: new Date().toISOString(),
      entries,
    }

    await this.writeIndex(index)
    return this.statusFromIndex(index, staleFiles)
  }

  async semanticSearch(input: {
    query: string
    limit?: number
    scoreThreshold?: number
    embeddingModel?: string
    forceReindex?: boolean
  }): Promise<VaultSemanticResult[]> {
    const embeddingModel = input.embeddingModel || EMBEDDING_MODEL_NAME
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 25)
    const scoreThreshold = input.scoreThreshold ?? 0.2
    const index = await this.ensureUsableIndex(embeddingModel, input.forceReindex)

    if (index.entries.length === 0) return []

    const response = await this.ollamaService.embed(embeddingModel, [input.query])
    const queryVector = response.embeddings[0]

    const scored = index.entries
      .map((entry) => ({
        title: entry.title,
        relativePath: entry.relativePath,
        folder: entry.folder,
        snippet: entry.text.slice(0, 700),
        tags: entry.tags,
        score: cosineSimilarity(queryVector, entry.embedding),
        chunkIndex: entry.chunkIndex,
      }))
      .filter((result) => result.score >= scoreThreshold)
      .sort((a, b) => b.score - a.score)

    return dedupeByFile(scored).slice(0, limit)
  }

  async ask(input: {
    question: string
    chatModel?: string
    embeddingModel?: string
    limit?: number
  }): Promise<{
    question: string
    answer: string | null
    model: string | null
    sources: VaultSemanticResult[] | VaultSearchResult[]
    mode: 'semantic' | 'keyword'
    aiAvailable: boolean
    fallback: boolean
    message?: string
  }> {
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 10)
    let mode: 'semantic' | 'keyword' = 'semantic'
    let sources: VaultSemanticResult[] | VaultSearchResult[]

    try {
      sources = await this.semanticSearch({
        query: input.question,
        limit,
        embeddingModel: input.embeddingModel,
        scoreThreshold: 0.15,
      })
    } catch {
      mode = 'keyword'
      sources = await this.vaultService.search(input.question, limit)
    }

    if (sources.length === 0) {
      return {
        question: input.question,
        answer: null,
        model: null,
        sources,
        mode,
        aiAvailable: false,
        fallback: true,
        message: 'No vault content matched this question.',
      }
    }

    const context = this.buildContextBlock(sources)

    try {
      const model = input.chatModel || (await this.resolveChatModel())
      const completion = await this.ollamaService.chat({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You answer questions using only the provided Obsidian Vault context. If the answer is not present in the context, say that the vault does not contain enough information. Always cite source file names in the answer.',
          },
          {
            role: 'user',
            content: `Question:\n${input.question}\n\nVault context:\n${context}`,
          },
        ],
      })

      return {
        question: input.question,
        answer: completion.message.content,
        model,
        sources,
        mode,
        aiAvailable: true,
        fallback: false,
      }
    } catch (error) {
      return {
        question: input.question,
        answer: this.buildOfflineFallbackAnswer(input.question, sources, error),
        model: null,
        sources,
        mode,
        aiAvailable: false,
        fallback: true,
        message: 'Local AI is unavailable. Returned matching vault snippets without generation.',
      }
    }
  }

  async getStatus(embeddingModel = EMBEDDING_MODEL_NAME): Promise<VaultIndexStatus | null> {
    const index = await this.readIndex(embeddingModel)
    return index ? this.statusFromIndex(index, 0) : null
  }

  async keywordFallback(query: string, limit = 20) {
    return this.vaultService.search(query, limit)
  }

  private async ensureUsableIndex(embeddingModel: string, forceReindex = false) {
    const current = forceReindex ? null : await this.readIndex(embeddingModel)
    const files = await this.vaultService.list(undefined, 5000)

    if (current && this.indexMatchesFiles(current, files)) {
      return current
    }

    await this.syncIndex({ embeddingModel, force: forceReindex })
    const rebuilt = await this.readIndex(embeddingModel)
    if (!rebuilt) {
      throw new Error('Vault vector index could not be created.')
    }
    return rebuilt
  }

  private indexMatchesFiles(
    index: VaultVectorIndex,
    files: Array<{ relativePath: string; updatedAt: string; sizeBytes: number }>
  ) {
    const indexedFiles = new Map<string, { sourceMtime: string; sourceSize: number }>()
    for (const entry of index.entries) {
      indexedFiles.set(entry.relativePath, {
        sourceMtime: entry.sourceMtime,
        sourceSize: entry.sourceSize,
      })
    }

    if (indexedFiles.size !== files.length) return false

    return files.every((file) => {
      const indexed = indexedFiles.get(file.relativePath)
      return indexed?.sourceMtime === file.updatedAt && indexed.sourceSize === file.sizeBytes
    })
  }

  private async embedChunks(embeddingModel: string, chunks: string[]) {
    const embeddings: number[][] = []

    for (let index = 0; index < chunks.length; index += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(index, index + EMBED_BATCH_SIZE)
      const response = await this.ollamaService.embed(embeddingModel, batch)
      embeddings.push(...response.embeddings)
    }

    return embeddings
  }

  private buildContextBlock(sources: Array<VaultSemanticResult | VaultSearchResult>) {
    return sources
      .map((source, index) => {
        const filename = basename(source.relativePath)
        return `[${index + 1}] ${filename}\nPath: ${source.relativePath}\n${source.snippet}`
      })
      .join('\n\n')
  }

  private buildOfflineFallbackAnswer(
    question: string,
    sources: Array<VaultSemanticResult | VaultSearchResult>,
    error: unknown
  ) {
    const sourceLines = sources
      .slice(0, 5)
      .map((source, index) => {
        const filename = basename(source.relativePath)
        const snippet = source.snippet.replace(/\s+/g, ' ').slice(0, 500)
        return `${index + 1}. ${filename} (${source.relativePath})\n   ${snippet}`
      })
      .join('\n\n')

    const detail = error instanceof Error ? error.message : String(error)

    return [
      'Local AI is unavailable, so MONAD is using offline Vault retrieval only.',
      '',
      `Question: ${question}`,
      '',
      'Matching local sources:',
      '',
      sourceLines,
      '',
      `AI status: unavailable (${detail})`,
    ].join('\n')
  }

  private async readIndex(embeddingModel: string): Promise<VaultVectorIndex | null> {
    try {
      const raw = (
        await readEncryptedStorageFile(assertProjectReadPath(this.indexPath()))
      ).toString('utf8')
      const parsed = JSON.parse(raw) as VaultVectorIndex
      if (parsed.version !== INDEX_VERSION || parsed.embeddingModel !== embeddingModel) return null
      if (!Array.isArray(parsed.entries)) return null
      return parsed
    } catch {
      return null
    }
  }

  private async writeIndex(index: VaultVectorIndex) {
    await mkdir(assertProjectWritePath(this.indexDir()), { recursive: true })
    await writeEncryptedStorageFile(
      assertProjectWritePath(this.indexPath()),
      `${JSON.stringify(index, null, 2)}\n`
    )
  }

  private statusFromIndex(index: VaultVectorIndex, staleFiles: number): VaultIndexStatus {
    return {
      indexedFiles: new Set(index.entries.map((entry) => entry.relativePath)).size,
      indexedChunks: index.entries.length,
      embeddingModel: index.embeddingModel,
      updatedAt: index.updatedAt,
      staleFiles,
    }
  }

  private resolveVaultPath(relativePath: string) {
    const root = this.vaultService.getRootPath()
    const resolved = resolve(root, relativePath)
    if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
      throw new Error('MONAD_SECURITY_VIOLATION: external storage attempt blocked')
    }
    return assertProjectReadPath(resolved)
  }

  private indexDir() {
    return assertProjectWritePath(join(this.vaultService.getRootPath(), INDEX_DIRNAME))
  }

  private indexPath() {
    return assertProjectWritePath(join(this.indexDir(), INDEX_FILENAME))
  }

  private async resolveChatModel(): Promise<string> {
    const models = await this.ollamaService.getModels()
    const model = models.find((item) => !item.name.toLowerCase().includes('embed'))
    if (!model) {
      throw new Error('No chat model is installed. Install or configure an AI model first.')
    }
    return model.name
  }
}
