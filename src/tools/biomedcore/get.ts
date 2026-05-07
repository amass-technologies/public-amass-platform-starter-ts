import { tool } from "ai"
import env from "../../env"
import { type BiomedcoreRecord, BiomedcoreRecordSchema, GetBiomedcoreRecordByIdInputSchema } from "./types"

export const getBiomedcoreRecordById = tool({
  description: `Amass BiomedCore — fetch a single publication record by Amass ID (AMBC_…), including title, abstract, authors, journal, MeSH terms, and citation metadata.
**Use when** you have an AMBC_ ID (from search, lookup, or a TrialCore cross-link) and need the full record. For free-text queries use search_biomedcore_records; to resolve a PMID/DOI first, use lookup_biomedcore_amass_id.`,
  inputSchema: GetBiomedcoreRecordByIdInputSchema,
  outputSchema: BiomedcoreRecordSchema,
  execute: async (input) => {
    const url = `${env.AMASS_API_BASE_URL}/api/v1/cores/biomedcore/records/${encodeURIComponent(input.amassId)}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.AMASS_API_KEY}` },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Amass API error ${response.status} ${response.statusText}: ${body}`)
    }
    const body = (await response.json()) as { data: BiomedcoreRecord }
    if (!body.data || typeof body.data !== "object") {
      throw new Error("Invalid response from Amass API.")
    }
    return body.data
  },
})

const TITLE_MAX = 90
const SHOW_AUTHORS = 3

export function formatGetBiomedcoreRecordByIdResult(result: BiomedcoreRecord): string {
  const lines: string[] = []
  const pmid = result.pmid ?? "—"
  const year = typeof result.publicationDate === "string" ? result.publicationDate.slice(0, 4) : "—"
  const cites = result.citationCount ?? "—"
  const jufo = result.journalQualityJufo ?? "—"
  lines.push(`${result.amassId}  PMID ${pmid} (${year})  cites: ${cites}  jufo: ${jufo}`)

  if (result.title) {
    lines.push(`  ${truncate(result.title, TITLE_MAX)}`)
  }

  const authors = formatAuthors(result.authors)
  const journal = result.journal ?? ""
  if (authors || journal) {
    lines.push(`  ${authors}${authors && journal ? " — " : ""}${journal}`)
  }

  return lines.join("\n")
}

function formatAuthors(authors: string[]): string {
  const head = authors.slice(0, SHOW_AUTHORS).map(authorShort).join(", ")
  return authors.length > SHOW_AUTHORS ? `${head}, +${authors.length - SHOW_AUTHORS}` : head
}

function authorShort(name: string): string {
  const tokens = name.trim().split(/\s+/)
  if (tokens.length < 2) {
    return name.trim()
  }
  const last = tokens[tokens.length - 1]
  const initial = tokens[0]?.charAt(0)
  if (!initial) {
    return name.trim()
  }
  return `${last} ${initial}`
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
