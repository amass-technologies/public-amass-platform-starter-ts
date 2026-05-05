import { type LanguageModel, type ModelMessage, stepCountIs, streamText } from "ai"
import { tools } from "./tools"

const SYSTEM_PROMPT = `You are Amass, a research assistant helping the user with biomedical research.

You have two search tools that query the Amass platform:
- search_biomedcore_records — peer-reviewed publications from BiomedCore (PubMed-derived). Use for papers, abstracts, drug-mechanism studies, citations, PMIDs/DOIs.
- search_trialcore_records — clinical trials from TrialCore (ClinicalTrials.gov-derived). Use for studies, recruitment status, sponsors, interventions, endpoints, NCT IDs.

Records are cross-linked: a publication knows which trials it references, and a trial knows which publications cite or describe it. Prefer these tools over guessing or general web knowledge.

When citing findings, reference papers by title and PMID/DOI, and trials by NCT ID and brief title, so the user can follow up.`

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
