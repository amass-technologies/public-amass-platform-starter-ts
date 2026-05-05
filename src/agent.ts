import { type LanguageModel, type ModelMessage, stepCountIs, streamText } from "ai"
import { tools } from "./tools"

const SYSTEM_PROMPT = "You are a helpful assistant. Use the available tools when relevant."

export interface RunTurnOpts {
  model: LanguageModel
  messages: ModelMessage[]
  onTextDelta: (text: string) => void
  onToolCall: (name: string, args: unknown) => void
  onToolResult: (name: string, result: unknown) => void
}

export async function runTurn(opts: RunTurnOpts): Promise<ModelMessage[]> {
  const result = streamText({
    model: opts.model,
    system: SYSTEM_PROMPT,
    messages: opts.messages,
    tools,
    stopWhen: stepCountIs(10),
  })

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      opts.onTextDelta(part.text)
    } else if (part.type === "tool-call") {
      opts.onToolCall(part.toolName, part.input)
    } else if (part.type === "tool-result") {
      opts.onToolResult(part.toolName, part.output)
    }
  }
  return (await result.response).messages
}
