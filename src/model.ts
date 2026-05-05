import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

export function getModel(spec: string): LanguageModel {
  const sep = spec.indexOf(":")
  if (sep === -1) {
    throw new Error(`Invalid MODEL spec "${spec}". Expected "provider:model-id".`)
  }
  const provider = spec.slice(0, sep)
  const modelId = spec.slice(sep + 1)
  switch (provider) {
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY must be set")
      }
      return anthropic(modelId)
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY must be set")
      }
      return openai(modelId)
    case "google":
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY must be set")
      }
      return google(modelId)
    case "litellm": {
      if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
        throw new Error("LITELLM_BASE_URL and LITELLM_API_KEY must be set")
      }
      const litellm = createOpenAICompatible({
        name: "litellm",
        baseURL: process.env.LITELLM_BASE_URL ?? "http://localhost:4000/v1",
        apiKey: process.env.LITELLM_API_KEY ?? "dummy",
      })
      return litellm(modelId)
    }
    default:
      throw new Error(`Unknown provider "${provider}". Known: anthropic, openai, google, litellm.`)
  }
}
