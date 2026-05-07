import { tool } from "ai"
import env from "../../env"
import { GetTrialcoreRecordByIdInputSchema, type TrialcoreRecord, TrialcoreRecordSchema } from "./types"

export const getTrialcoreRecordById = tool({
  description: `Amass TrialCore — fetch a single clinical trial record by Amass ID (AMTC_…), including phase, status, sponsor, conditions, interventions, design, and outcome measures.
**Use when** you have an AMTC_ ID (from search, lookup, or a BiomedCore cross-link) and need the full record. For free-text queries use search_trialcore_records; to resolve an NCT ID first, use lookup_trialcore_amass_id.`,
  inputSchema: GetTrialcoreRecordByIdInputSchema,
  outputSchema: TrialcoreRecordSchema,
  execute: async (input) => {
    const url = `${env.AMASS_API_BASE_URL}/api/v1/cores/trialcore/records/${encodeURIComponent(input.amassId)}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.AMASS_API_KEY}` },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Amass API error ${response.status} ${response.statusText}: ${body}`)
    }
    const body = (await response.json()) as { data: TrialcoreRecord }
    if (!body.data || typeof body.data !== "object") {
      throw new Error("Invalid response from Amass API.")
    }
    return body.data
  },
})

const TITLE_MAX = 90
const SHOW_LIST = 3

export function formatGetTrialcoreRecordByIdResult(result: TrialcoreRecord): string {
  const lines: string[] = []
  const nctId = result.nctId ?? "—"
  const phase = result.phase ?? "—"
  const status = result.overallStatus ?? "—"
  const studyType = result.studyType ?? "—"
  const enrollment = result.enrollment ?? "—"
  lines.push(`${result.amassId}  ${nctId}  ${phase}  ${status}  (${studyType})  n=${enrollment}`)

  if (result.briefTitle) {
    lines.push(`  ${truncate(result.briefTitle, TITLE_MAX)}`)
  }

  const detailParts: string[] = []
  if (result.sponsorName) {
    detailParts.push(`${result.sponsorName}${result.sponsorType ? ` (${result.sponsorType})` : ""}`)
  }
  if (result.interventionNames.length) {
    detailParts.push(`int: ${formatList(result.interventionNames, SHOW_LIST)}`)
  }
  if (result.conditions.length) {
    detailParts.push(`cond: ${formatList(result.conditions, SHOW_LIST)}`)
  }
  if (detailParts.length) {
    lines.push(`  ${detailParts.join(" — ")}`)
  }

  return lines.join("\n")
}

function formatList(items: string[], max: number): string {
  const head = items.slice(0, max).join(", ")
  return items.length > max ? `${head}, +${items.length - max}` : head
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
