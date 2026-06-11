import { basename } from 'node:path'
import type { VaultSearchResult } from '#services/vault_service'
import type { VaultSemanticResult } from '#services/vault_intelligence_service'

export const MONAD_ORCHESTRATOR_MODELS = [
  'qwen2.5:7b',
  'llama3.1',
  'mistral',
  'deepseek-coder-v2',
  'qwen2.5-coder:7b',
] as const

export type MonadOrchestratorModel = (typeof MONAD_ORCHESTRATOR_MODELS)[number]

export type MonadRequestCategory =
  | 'CHAT'
  | 'REASONING'
  | 'CODE'
  | 'MEMORY'
  | 'RETRIEVAL'
  | 'TOOL'

export type MonadPrimaryCategory = MonadRequestCategory | 'MIXED'

export type MonadToolKind = 'file' | 'code' | 'system'

export type MonadToolSignal = {
  needed: boolean
  kind: MonadToolKind | null
  reason: string | null
}

export type MonadMemorySource = {
  title: string
  relativePath: string
  folder: string
  snippet: string
  tags: string[]
  score?: number
}

export type MonadOrchestrationInput = {
  prompt: string
  system?: string
  model?: string
  disableMemory?: boolean
  forceTool?: boolean
  mode?: 'auto' | 'manual'
}

export type MonadOrchestrationResult = {
  mode: 'auto' | 'manual'
  primaryCategory: MonadPrimaryCategory
  categories: MonadRequestCategory[]
  selectedModel: string
  modelReason: string
  memory: {
    enabled: boolean
    used: boolean
    mode: 'semantic' | 'keyword' | 'disabled' | 'none'
    sources: MonadMemorySource[]
    message?: string
  }
  tool: MonadToolSignal
  context: string
}

type VaultIntelligenceClient = {
  semanticSearch(input: {
    query: string
    limit?: number
    scoreThreshold?: number
  }): Promise<VaultSemanticResult[]>
  keywordFallback(query: string, limit?: number): Promise<VaultSearchResult[]>
}

const CHAT_MODEL: MonadOrchestratorModel = 'qwen2.5:7b'
const DEEP_REASONING_MODEL: MonadOrchestratorModel = 'llama3.1'
const FAST_MODEL: MonadOrchestratorModel = 'mistral'
const CODE_MODEL: MonadOrchestratorModel = 'deepseek-coder-v2'
const LIGHT_CODE_MODEL: MonadOrchestratorModel = 'qwen2.5-coder:7b'

const CLASSIFIERS: Array<{
  category: MonadRequestCategory
  patterns: RegExp[]
}> = [
  {
    category: 'CODE',
    patterns: [
      /\b(code|program|script|function|class|typescript|javascript|python|node|docker|compose)\b/i,
      /\b(debug|bug|error|stack trace|refactor|implement|api|endpoint|test|compile)\b/i,
    ],
  },
  {
    category: 'MEMORY',
    patterns: [
      /\b(memory|remember|past|previous|history|context|what did i say|what have i said)\b/i,
      /\b(notes?|documents?|vault|obsidian|wiki|knowledge)\b/i,
    ],
  },
  {
    category: 'RETRIEVAL',
    patterns: [
      /\b(search|semantic|retrieve|lookup|find|index|embedding|vector|rag)\b/i,
      /\b(sources?|citations?|from my vault|from the vault|from docs?)\b/i,
    ],
  },
  {
    category: 'TOOL',
    patterns: [
      /\b(run|execute|command|terminal|shell|filesystem|file operation|system info)\b/i,
      /\b(list files|read file|write file|docker ps|logs?|status)\b/i,
    ],
  },
  {
    category: 'REASONING',
    patterns: [
      /\b(reason|analyze|analyse|architecture|design|plan|compare|tradeoff|why|explain)\b/i,
      /\b(security|threat|risk|strategy|workflow|complex|diagnose)\b/i,
    ],
  },
]

function uniqueCategories(categories: MonadRequestCategory[]) {
  return Array.from(new Set(categories))
}

function containsAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function sanitizeSnippet(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 700)
}

function toMemorySource(source: VaultSemanticResult | VaultSearchResult): MonadMemorySource {
  return {
    title: source.title,
    relativePath: source.relativePath,
    folder: source.folder,
    snippet: sanitizeSnippet(source.snippet),
    tags: source.tags,
    score: 'score' in source ? source.score : undefined,
  }
}

export class AiOrchestratorService {
  constructor(private vaultIntelligence?: VaultIntelligenceClient) {}

  async route(input: MonadOrchestrationInput): Promise<MonadOrchestrationResult> {
    const mode = input.mode === 'manual' || input.model ? 'manual' : 'auto'
    const categories = this.classify(input.prompt)
    const primaryCategory = this.primaryCategory(categories)
    const tool = this.detectTool(input.prompt, input.forceTool)
    const selectedModel = input.model || this.selectModel(input.prompt, categories)
    const memory = await this.retrieveMemory(input.prompt, categories, input.disableMemory)
    const context = this.buildContext({
      prompt: input.prompt,
      system: input.system,
      categories,
      primaryCategory,
      selectedModel,
      tool,
      memory,
    })

    return {
      mode,
      primaryCategory,
      categories,
      selectedModel,
      modelReason: input.model
        ? 'Manual model override supplied by request.'
        : this.modelReason(input.prompt, categories),
      memory,
      tool,
      context,
    }
  }

  classify(prompt: string): MonadRequestCategory[] {
    const matches = CLASSIFIERS.filter((classifier) =>
      containsAny(prompt, classifier.patterns)
    ).map((classifier) => classifier.category)

    if (matches.length === 0) return ['CHAT']
    return uniqueCategories(matches)
  }

  selectModel(prompt: string, categories: MonadRequestCategory[]): MonadOrchestratorModel {
    const lower = prompt.toLowerCase()

    if (categories.includes('CODE')) {
      if (/\b(debug|bug|error|stack trace|refactor|architecture|security|complex)\b/i.test(prompt)) {
        return CODE_MODEL
      }
      return LIGHT_CODE_MODEL
    }

    if (
      categories.includes('REASONING') &&
      /\b(deep|complex|architecture|threat|security|tradeoff|diagnose|strategy)\b/i.test(prompt)
    ) {
      return DEEP_REASONING_MODEL
    }

    if (categories.length === 1 && categories[0] === 'CHAT' && /\b(fast|quick|short|brief)\b/.test(lower)) {
      return FAST_MODEL
    }

    return CHAT_MODEL
  }

  detectTool(prompt: string, forceTool = false): MonadToolSignal {
    if (forceTool) {
      return {
        needed: true,
        kind: 'system',
        reason: 'Tool execution was forced by the request.',
      }
    }

    if (/\b(read|write|edit|delete|rename|list files|filesystem|file)\b/i.test(prompt)) {
      return {
        needed: true,
        kind: 'file',
        reason: 'The request asks for file-system interaction.',
      }
    }

    if (/\b(run|execute|test|compile|script|command|terminal|shell)\b/i.test(prompt)) {
      return {
        needed: true,
        kind: 'code',
        reason: 'The request asks for command or code execution.',
      }
    }

    if (/\b(system info|docker ps|container status|logs?|ports?|network)\b/i.test(prompt)) {
      return {
        needed: true,
        kind: 'system',
        reason: 'The request needs system or runtime information.',
      }
    }

    return { needed: false, kind: null, reason: null }
  }

  private primaryCategory(categories: MonadRequestCategory[]): MonadPrimaryCategory {
    return categories.length > 1 ? 'MIXED' : categories[0]
  }

  private modelReason(prompt: string, categories: MonadRequestCategory[]) {
    if (categories.includes('CODE')) return 'Coding-oriented request routed to a coder model.'
    if (categories.includes('REASONING') && this.selectModel(prompt, categories) === DEEP_REASONING_MODEL) {
      return 'Complex reasoning request routed to the deep reasoning model.'
    }
    if (this.selectModel(prompt, categories) === FAST_MODEL) {
      return 'Short chat request routed to the fast lightweight model.'
    }
    return 'Default balanced local model selected.'
  }

  private async retrieveMemory(
    prompt: string,
    categories: MonadRequestCategory[],
    disabled = false
  ): Promise<MonadOrchestrationResult['memory']> {
    const shouldRetrieve = categories.includes('MEMORY') || categories.includes('RETRIEVAL')

    if (disabled) {
      return {
        enabled: false,
        used: false,
        mode: 'disabled',
        sources: [],
        message: 'Memory retrieval disabled by request.',
      }
    }

    if (!shouldRetrieve) {
      return {
        enabled: true,
        used: false,
        mode: 'none',
        sources: [],
      }
    }

    const vaultIntelligence = await this.getVaultIntelligence()

    try {
      const semantic = await vaultIntelligence.semanticSearch({
        query: prompt,
        limit: 5,
        scoreThreshold: 0.15,
      })

      if (semantic.length > 0) {
        return {
          enabled: true,
          used: true,
          mode: 'semantic',
          sources: semantic.map(toMemorySource),
        }
      }
    } catch {
      // Fall through to keyword search when embeddings or local AI are unavailable.
    }

    try {
      const keyword = await vaultIntelligence.keywordFallback(prompt, 5)
      return {
        enabled: true,
        used: keyword.length > 0,
        mode: 'keyword',
        sources: keyword.map(toMemorySource),
        message:
          keyword.length > 0
            ? 'Semantic retrieval unavailable; keyword Vault retrieval was used.'
            : 'No relevant Vault memory was found.',
      }
    } catch (error) {
      return {
        enabled: true,
        used: false,
        mode: 'keyword',
        sources: [],
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async getVaultIntelligence(): Promise<VaultIntelligenceClient> {
    if (!this.vaultIntelligence) {
      const { VaultIntelligenceService } = await import('#services/vault_intelligence_service')
      this.vaultIntelligence = new VaultIntelligenceService()
    }

    return this.vaultIntelligence
  }

  private buildContext(input: {
    prompt: string
    system?: string
    categories: MonadRequestCategory[]
    primaryCategory: MonadPrimaryCategory
    selectedModel: string
    tool: MonadToolSignal
    memory: MonadOrchestrationResult['memory']
  }) {
    const memoryBlock =
      input.memory.sources.length > 0
        ? input.memory.sources
            .map((source, index) => {
              const score =
                typeof source.score === 'number' ? `\nScore: ${source.score.toFixed(3)}` : ''
              return `[${index + 1}] ${basename(source.relativePath)}\nPath: ${
                source.relativePath
              }${score}\n${source.snippet}`
            })
            .join('\n\n')
        : input.memory.message || 'No relevant memory retrieved.'

    const toolBlock = input.tool.needed
      ? `Tool needed: ${input.tool.kind}\nReason: ${input.tool.reason}\nTool output: none provided. Do not fabricate command, filesystem, or system results.`
      : 'No tool needed. No external tool output provided.'

    return [
      'SYSTEM INSTRUCTION',
      input.system ||
        [
          'You are MONAD, a local-first AI orchestration system.',
          'Use exactly the selected local model for this request.',
          'Use retrieved memory only when it is relevant.',
          'Never invent tool output; explicitly state when a tool is needed.',
        ].join(' '),
      '',
      'ROUTING',
      `Primary category: ${input.primaryCategory}`,
      `Categories: ${input.categories.join(', ')}`,
      `Selected model: ${input.selectedModel}`,
      '',
      'USER INPUT',
      input.prompt,
      '',
      'RETRIEVED MEMORY',
      memoryBlock,
      '',
      'TOOL OUTPUTS',
      toolBlock,
    ].join('\n')
  }
}
