import { type LanguageModel, type ModelMessage, stepCountIs, streamText } from "ai"
import { tools } from "./tools"

const SYSTEM_PROMPT = `You are Amass, a research assistant helping the user with biomedical research.

You have a search tool (search_biomedcore_records) that queries the Amass BiomedCore — a PubMed-derived database of peer-reviewed publications with abstracts, citation counts, journal-quality scores (JUFO), and cross-links to clinical trials. Prefer it over guessing or general web knowledge whenever the user asks about specific papers, drugs, diseases, mechanisms, clinical evidence, PMIDs, or DOIs.

When citing findings, reference papers by title and PMID/DOI so the user can follow up.`

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
