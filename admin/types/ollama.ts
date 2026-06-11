export type MonadOllamaModel = {
  id: string
  name: string
  description: string
  estimated_pulls: string
  model_last_updated: string
  first_seen: string
  tags: MonadOllamaModelTag[]
}

export type MonadOllamaModelTag = {
  name: string
  size: string
  context: string
  input: string
  cloud: boolean
  thinking: boolean
}

export type MonadOllamaModelAPIResponse = {
  success: boolean
  message: string
  models: MonadOllamaModel[]
}

export type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OllamaChatRequest = {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
  sessionId?: number
}

export type OllamaChatResponse = {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

export type MonadInstalledModel = {
  name: string
  size: number
  digest?: string
  details?: Record<string, any>
}

export type MonadChatResponse = {
  message: { content: string; thinking?: string }
  done: boolean
  model: string
}
