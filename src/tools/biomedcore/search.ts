import { tool } from "ai"
import { z } from "zod"
import { type BiomedcoreRecord, BiomedcoreRecordSchema, SearchBiomedcoreRecordsInputSchema } from "./types"

export const searchBiomedcoreRecords = tool({
  description: `Amass BiomedCore — search 39M+ PubMed/PMC publication records enriched with abstracts, MeSH terms, JUFO journal quality, and citation counts. Returns Amass IDs (AMBC_…) that link to TrialCore via the lookup/get tools.
**Use when** finding peer-reviewed biomedical literature, systematic reviews, clinical evidence, drug mechanism studies, or life science research — even if the user does not explicitly mention "amass" or "BiomedCore". Free-text query with optional date / citation / journal-quality / retraction filters.`,
  inputSchema: SearchBiomedcoreRecordsInputSchema,
  outputSchema: z.array(BiomedcoreRecordSchema),
  execute: async (input) => {
    const apiKey = process.env.AMASS_API_KEY
    if (!apiKey) {
      throw new Error("AMASS_API_KEY must be set to call the Amass API.")
    }

    const params = new URLSearchParams()
    params.set("query", input.query)
    params.set("limit", "10")
    if (input.minPublicationDate) {
      params.set("minPublicationDate", input.minPublicationDate)
    }
    if (input.maxPublicationDate) {
      params.set("maxPublicationDate", input.maxPublicationDate)
    }
    if (input.minCitationCount !== undefined) {
      params.set("minCitationCount", String(input.minCitationCount))
    }
    if (input.minJournalQualityJufo !== undefined) {
      params.set("minJournalQualityJufo", String(input.minJournalQualityJufo))
    }
    if (input.isRetracted !== undefined) {
      params.set("isRetracted", String(input.isRetracted))
    }

    const url = `https://api.amass.tech/api/v1/cores/biomedcore/records?${params.toString()}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Amass API error ${response.status} ${response.statusText}: ${body}`)
    }
    const body = (await response.json()) as { data: BiomedcoreRecord[] }
    if (!Array.isArray(body.data)) {
      throw new Error("Invalid response from Amass API.")
    }
    return body.data
  },
})

const SHOW_RECORDS = 3
const SHOW_AUTHORS = 3
const TITLE_MAX = 90

export function formatSearchBiomedcoreRecordsResult(result: BiomedcoreRecord[]): string {
  const total = result.length
  const lines: string[] = [`${total} record${total === 1 ? "" : "s"}`]
  for (let i = 0; i < Math.min(SHOW_RECORDS, total); i++) {
    const r = result[i]
    if (!r) {
      continue
    }
    const pmid = r.pmid ?? "—"
    const year = typeof r.publicationDate === "string" ? r.publicationDate.slice(0, 4) : "—"
    const cites = r.citationCount ?? "—"
    const jufo = r.journalQualityJufo ?? "—"
    const title = typeof r.title === "string" ? truncate(r.title, TITLE_MAX) : "—"
    const authors = Array.isArray(r.authors) ? formatAuthors(r.authors) : ""
    const journal = typeof r.journal === "string" ? r.journal : ""
    lines.push(` ${i + 1}. PMID ${pmid} (${year})  cites: ${cites}  jufo: ${jufo}`)
    lines.push(`    ${title}`)
    if (authors || journal) {
      lines.push(`    ${authors}${authors && journal ? " — " : ""}${journal}`)
    }
  }
  if (total > SHOW_RECORDS) {
    lines.push(` … +${total - SHOW_RECORDS} more`)
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
