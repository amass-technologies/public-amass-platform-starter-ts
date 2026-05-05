import { z } from "zod"

export const BiomedcoreRecordSchema = z.object({
  amassId: z.string().describe("Unique Amass identifier."),
  pmid: z.string().nullable().describe("PubMed identifier."),
  pmcid: z.string().nullable().describe("PubMed Central identifier (e.g. PMC1234567)."),
  doi: z.string().nullable().describe("Digital Object Identifier."),
  title: z.string().nullable(),
  abstract: z.string().nullable(),
  authors: z.array(z.string()),
  journal: z.string().nullable(),
  issn: z.string().nullable(),
  volumeIssue: z.string().nullable().describe("Combined volume and issue (e.g. '23(4)')."),
  language: z.string().nullable().describe("ISO 639-2 language code (e.g. 'eng')."),
  publicationDate: z.string().nullable().describe("ISO 8601 date (YYYY-MM-DD)."),
  publicationTypes: z.array(z.string()).describe("MeSH publication types (e.g. Clinical Trial, Review)."),
  isRetracted: z.boolean().nullable(),
  citationCount: z.number().nullable(),
  journalQualityJufo: z.number().describe("JUFO publication-forum classification (0-3)."),
  meshTerms: z.array(z.string()).describe("MeSH descriptor names."),
  keywords: z.array(z.string()),
  substances: z.array(z.string()).describe("Chemical/drug names from NLM registry."),
})

export type BiomedcoreRecord = z.infer<typeof BiomedcoreRecordSchema>

export const GetBiomedcoreRecordByIdInputSchema = z.object({
  amassId: z.string().min(1).describe("Amass record identifier (e.g. AMBC_…)."),
})

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const SearchBiomedcoreRecordsInputSchema = z.object({
  query: z.string().describe("Free-text search terms.").min(1),
  minPublicationDate: z.string().regex(datePattern).optional().describe("Earliest publication date (YYYY-MM-DD)."),
  maxPublicationDate: z.string().regex(datePattern).optional().describe("Latest publication date (YYYY-MM-DD)."),
  minCitationCount: z.number().int().min(0).max(100000).optional().describe("Minimum citation count."),
  minJournalQualityJufo: z
    .number()
    .int()
    .min(0)
    .max(3)
    .optional()
    .describe("Minimum JUFO publication-forum classification (0-3)."),
  isRetracted: z.boolean().optional().describe("Filter for retracted articles."),
})

const LookupBiomedcoreItemSchema = z.union([
  z.object({ pmid: z.string().describe("PubMed identifier.") }),
  z.object({ doi: z.string().describe("Digital Object Identifier.") }),
])

export const LookupBiomedcoreAmassIdInputSchema = z.object({
  items: z
    .array(LookupBiomedcoreItemSchema)
    .min(1)
    .describe("Items to resolve. Each item must specify either pmid or doi (not both)."),
})

export const LookupBiomedcoreAmassIdResultSchema = z.object({
  input: LookupBiomedcoreItemSchema,
  amassIds: z.array(z.string()).describe("Matching Amass record IDs (e.g. AMBC_…)."),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
})

export type LookupBiomedcoreAmassIdResult = z.infer<typeof LookupBiomedcoreAmassIdResultSchema>
