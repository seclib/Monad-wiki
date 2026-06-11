import vine from '@vinejs/vine'
import { VAULT_FOLDERS } from '#services/vault_service'

export const vaultSaveValidator = vine.compile(
  vine.object({
    folder: vine.enum(VAULT_FOLDERS),
    title: vine.string().trim().minLength(1).maxLength(255),
    content: vine.string().trim().minLength(1).maxLength(200000),
    tags: vine.array(vine.string().trim().minLength(1).maxLength(60)).maxLength(24).optional(),
    filename: vine.string().trim().maxLength(120).optional(),
    metadata: vine.any().optional(),
  })
)

export const aiQueryValidator = vine.compile(
  vine.object({
    model: vine.string().trim().minLength(1).maxLength(120).optional(),
    prompt: vine.string().trim().minLength(1).maxLength(100000),
    system: vine.string().trim().maxLength(20000).optional(),
    mode: vine.enum(['auto', 'manual']).optional(),
    disableMemory: vine.boolean().optional(),
    forceTool: vine.boolean().optional(),
    saveToVault: vine.boolean().optional(),
    title: vine.string().trim().maxLength(255).optional(),
    tags: vine.array(vine.string().trim().minLength(1).maxLength(60)).maxLength(24).optional(),
  })
)

export const vaultIndexValidator = vine.compile(
  vine.object({
    embeddingModel: vine.string().trim().minLength(1).maxLength(120).optional(),
    force: vine.boolean().optional(),
  })
)

export const vaultSemanticSearchValidator = vine.compile(
  vine.object({
    query: vine.string().trim().minLength(1).maxLength(2000),
    limit: vine.number().min(1).max(25).optional(),
    scoreThreshold: vine.number().min(0).max(1).optional(),
    embeddingModel: vine.string().trim().minLength(1).maxLength(120).optional(),
    forceReindex: vine.boolean().optional(),
  })
)

export const vaultAskValidator = vine.compile(
  vine.object({
    question: vine.string().trim().minLength(1).maxLength(10000),
    model: vine.string().trim().minLength(1).maxLength(120).optional(),
    embeddingModel: vine.string().trim().minLength(1).maxLength(120).optional(),
    limit: vine.number().min(1).max(10).optional(),
  })
)
