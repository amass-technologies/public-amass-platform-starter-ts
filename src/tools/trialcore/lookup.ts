import { tool } from "ai"
import { z } from "zod"
import env from "../../env"
import {
  LookupTrialcoreAmassIdInputSchema,
  type LookupTrialcoreAmassIdResult,
  LookupTrialcoreAmassIdResultSchema,
} from "./types"

export const lookupTrialcoreAmassId = tool({
  description: `Amass TrialCore — resolve ClinicalTrials.gov NCT identifiers to Amass record IDs (AMTC_…). Accepts a batch of items in a single call.
**Use when** the user supplies one or more NCT IDs. Pair with get_trialcore_record_by_id to fetch the full record, or use the AMTC IDs to follow cross-links from BiomedCore.`,
  inputSchema: LookupTrialcoreAmassIdInputSchema,
  outputSchema: z.array(LookupTrialcoreAmassIdResultSchema),
  execute: async (input) => {
    const url = `${env.AMASS_API_BASE_URL}/api/v1/cores/trialcore/records/lookup`
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${env.AMASS_API_KEY}`,
        "Content-Type": "application/json",
      },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Amass API error ${response.status} ${response.statusText}: ${body}`)
    }
    const body = (await response.json()) as { data: LookupTrialcoreAmassIdResult[] }
    if (!Array.isArray(body.data)) {
      throw new Error("Invalid response from Amass API.")
    }
    return body.data
  },
})

const SHOW_LOOKUPS = 5

export function formatLookupTrialcoreAmassIdResult(result: LookupTrialcoreAmassIdResult[]): string {
  const total = result.length
  const lines: string[] = [`${total} lookup${total === 1 ? "" : "s"}`]
  for (let i = 0; i < Math.min(SHOW_LOOKUPS, total); i++) {
    const r = result[i]
    if (!r) {
      continue
    }
    const id = `NCT ${r.input.nctId}`
    if (r.error) {
      lines.push(` ${i + 1}. ${id} → error (${r.error.code}: ${r.error.message})`)
    } else if (r.amassIds.length === 0) {
      lines.push(` ${i + 1}. ${id} → no match`)
    } else {
      lines.push(` ${i + 1}. ${id} → ${r.amassIds.join(", ")}`)
    }
  }
  if (total > SHOW_LOOKUPS) {
    lines.push(` … +${total - SHOW_LOOKUPS} more`)
  }
  return lines.join("\n")
}
