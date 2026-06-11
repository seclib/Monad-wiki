import { VAULT_FOLDERS, VaultService } from '#services/vault_service'
import type { VaultFolder } from '#services/vault_service'
import { vaultSaveValidator } from '#validators/vault'
import type { HttpContext } from '@adonisjs/core/http'

export default class VaultController {
  private vaultService = new VaultService()

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
}
