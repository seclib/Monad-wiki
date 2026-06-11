import { OllamaService } from '#services/ollama_service'
import { VaultService } from '#services/vault_service'
import { aiQueryValidator } from '#validators/vault'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

@inject()
export default class AiController {
  constructor(private ollamaService: OllamaService) {}

  private vaultService = new VaultService()

  async query({ request, response }: HttpContext) {
    const payload = await request.validateUsing(aiQueryValidator)
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    if (payload.system) {
      messages.push({ role: 'system', content: payload.system })
    }
    messages.push({ role: 'user', content: payload.prompt })

    try {
      const completion = await this.ollamaService.chat({
        model: payload.model,
        messages,
        stream: false,
      })

      const content = completion.message.content
      const vault = payload.saveToVault
        ? await this.vaultService.saveAiOutput({
            title: payload.title || payload.prompt.slice(0, 80),
            prompt: payload.prompt,
            response: content,
            model: payload.model,
            tags: payload.tags ?? [],
          })
        : null

      return {
        model: completion.model,
        response: content,
        vault,
      }
    } catch (error) {
      return response.status(503).send({
        error: 'ollama_unavailable',
        message:
          'Ollama is not reachable. Start the host Ollama service and verify OLLAMA_BASE_URL.',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
