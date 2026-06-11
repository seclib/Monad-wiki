import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { AiOrchestratorService } from '../../app/services/ai_orchestrator_service.js'

test('classifies coding requests and selects the deep coder model for debugging', () => {
  const orchestrator = new AiOrchestratorService()
  const prompt = 'Debug this TypeScript Docker error and explain the fix.'

  const categories = orchestrator.classify(prompt)

  assert.ok(categories.includes('CODE'))
  assert.ok(categories.includes('REASONING'))
  assert.equal(orchestrator.selectModel(prompt, categories), 'deepseek-coder-v2')
})

test('detects file tool needs without fabricating tool output', () => {
  const orchestrator = new AiOrchestratorService()
  const tool = orchestrator.detectTool('Read the README file and summarize it.')

  assert.equal(tool.needed, true)
  assert.equal(tool.kind, 'file')
  assert.match(tool.reason ?? '', /file-system/i)
})

test('routes a memory request with memory disabled and a manual model override', async () => {
  const orchestrator = new AiOrchestratorService()

  const result = await orchestrator.route({
    prompt: 'What did I say in my notes about local Docker setup?',
    model: 'llama3.1',
    disableMemory: true,
  })

  assert.equal(result.mode, 'manual')
  assert.equal(result.selectedModel, 'llama3.1')
  assert.equal(result.memory.enabled, false)
  assert.equal(result.memory.mode, 'disabled')
  assert.ok(result.categories.includes('MEMORY'))
  assert.match(result.context, /SYSTEM INSTRUCTION/)
  assert.match(result.context, /RETRIEVED MEMORY/)
  assert.match(result.context, /TOOL OUTPUTS/)
})
