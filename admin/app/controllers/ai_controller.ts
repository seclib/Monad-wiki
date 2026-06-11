import { AiOrchestratorService } from '#services/ai_orchestrator_service'
import { OllamaService } from '#services/ollama_service'
import { VaultService } from '#services/vault_service'
import { aiQueryValidator } from '#validators/vault'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

@inject()
export default class AiController {
  constructor(private ollamaService: OllamaService) {}

  private vaultService = new VaultService()
  private aiOrchestrator = new AiOrchestratorService()

  async query({ request, response }: HttpContext) {
    const payload = await request.validateUsing(aiQueryValidator)

    try {
      const orchestration = await this.aiOrchestrator.route({
        prompt: payload.prompt,
        system: payload.system,
        model: payload.model,
        mode: payload.mode,
        disableMemory: payload.disableMemory,
        forceTool: payload.forceTool,
      })

      const completion = await this.ollamaService.chat({
        model: orchestration.selectedModel,
        messages: [{ role: 'user', content: orchestration.context }],
        stream: false,
      })

      const content = completion.message.content
      const vault = payload.saveToVault
        ? await this.vaultService.saveAiOutput({
            title: payload.title || payload.prompt.slice(0, 80),
            prompt: payload.prompt,
            response: content,
            model: orchestration.selectedModel,
            tags: payload.tags ?? [],
          })
        : null

      return {
        model: completion.model,
        selectedModel: orchestration.selectedModel,
        orchestration: {
          mode: orchestration.mode,
          primaryCategory: orchestration.primaryCategory,
          categories: orchestration.categories,
          modelReason: orchestration.modelReason,
          memory: {
            enabled: orchestration.memory.enabled,
            used: orchestration.memory.used,
            mode: orchestration.memory.mode,
            sources: orchestration.memory.sources.map((source) => ({
              title: source.title,
              relativePath: source.relativePath,
              folder: source.folder,
              tags: source.tags,
              score: source.score,
            })),
            message: orchestration.memory.message,
          },
          tool: orchestration.tool,
        },
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
