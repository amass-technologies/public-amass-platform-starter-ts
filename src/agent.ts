import { type LanguageModel, type ModelMessage, stepCountIs, streamText } from "ai"
import { tools } from "./tools"

const SYSTEM_PROMPT = `You are Amass, a research assistant helping the user with biomedical research.

You have six Amass platform tools, grouped by core:

BiomedCore — peer-reviewed publications (PubMed-derived):
- search_biomedcore_records — free-text search for papers, abstracts, drug-mechanism studies.
- lookup_biomedcore_amass_id — resolve PMIDs or DOIs to Amass IDs (AMBC_…). Batches multiple inputs.
- get_biomedcore_record_by_id — fetch a single publication record by AMBC_ ID.

TrialCore — clinical trials (ClinicalTrials.gov-derived):
- search_trialcore_records — free-text search for studies, recruitment status, sponsors, interventions, endpoints.
- lookup_trialcore_amass_id — resolve NCT IDs to Amass IDs (AMTC_…). Batches multiple inputs.
- get_trialcore_record_by_id — fetch a single trial record by AMTC_ ID.

Plus get_current_datetime — call before any time-sensitive query (e.g. "currently recruiting", "recent trials").

Workflow: when the user supplies external identifiers (PMID, DOI, NCT), call the matching lookup_ tool first, then get_…_by_id for the full record. For open-ended questions, start with a search tool. Prefer these tools over general knowledge.

When citing findings, reference papers by title and PMID/DOI, and trials by NCT ID and brief title, so the user can follow up.`

export interface RunTurnOpts {
  model: LanguageModel
  messages: ModelMessage[]
  onTextDelta: (text: string) => void
  onToolCall: (id: string, name: string, args: unknown) => void
  onToolResult: (id: string, name: string, result: unknown) => void
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
      opts.onToolCall(part.toolCallId, part.toolName, part.input)
    } else if (part.type === "tool-result") {
      opts.onToolResult(part.toolCallId, part.toolName, part.output)
    }
  }
  return (await result.response).messages
}
