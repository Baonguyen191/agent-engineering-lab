import { useSyncExternalStore } from 'react'

/**
 * Real-LLM settings for the Coding Lab.
 * Base URL and model name are not secret and are kept in localStorage.
 * The API key is kept ONLY in memory: it disappears when the tab reloads, and is never written to
 * localStorage, sessionStorage, progress exports or logs.
 */
export interface LlmConfig {
  baseUrl: string
  model: string
  apiKey: string
}

const KEY = 'ael:llm'

function loadPublic(): Pick<LlmConfig, 'baseUrl' | 'model'> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<LlmConfig>
      return { baseUrl: String(p.baseUrl ?? ''), model: String(p.model ?? '') }
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
}

let config: LlmConfig = { ...loadPublic(), apiKey: '' }
const listeners = new Set<() => void>()

export function setLlmConfig(next: Partial<LlmConfig>) {
  config = { ...config, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify({ baseUrl: config.baseUrl, model: config.model }))
  } catch {
    /* ignore */
  }
  for (const l of listeners) l()
}

export const getLlmConfig = (): LlmConfig => config
export const isLlmConfigured = (c: LlmConfig = config) => Boolean(c.baseUrl && c.model && c.apiKey)

export function useLlmConfig(): LlmConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => config,
  )
}

/** Environment variables passed to labkit for one run. */
export function llmEnv(mode: 'mock' | 'real'): Record<string, string> {
  if (mode === 'mock') return { LAB_LLM_MODE: 'mock' }
  return {
    LAB_LLM_MODE: 'real',
    LAB_LLM_BASE_URL: config.baseUrl,
    LAB_LLM_MODEL: config.model,
    LAB_LLM_API_KEY: config.apiKey,
  }
}

export const PROVIDER_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'LiteLLM proxy (local)', baseUrl: 'http://localhost:4000', model: 'gpt-4o-mini' },
]
