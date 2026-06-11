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
    model: vine.string().trim().minLength(1).maxLength(120),
    prompt: vine.string().trim().minLength(1).maxLength(100000),
    system: vine.string().trim().maxLength(20000).optional(),
    saveToVault: vine.boolean().optional(),
    title: vine.string().trim().maxLength(255).optional(),
    tags: vine.array(vine.string().trim().minLength(1).maxLength(60)).maxLength(24).optional(),
  })
)
