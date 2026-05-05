import { z } from "zod"

const phaseEnum = z.enum([
  "EARLY_PHASE1",
  "PHASE1",
  "PHASE1/PHASE2",
  "PHASE2",
  "PHASE2/PHASE3",
  "PHASE3",
  "PHASE4",
  "NA",
])
const overallStatusEnum = z.enum([
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ENROLLING_BY_INVITATION",
  "ACTIVE_NOT_RECRUITING",
  "SUSPENDED",
  "TERMINATED",
  "COMPLETED",
  "WITHDRAWN",
  "UNKNOWN",
  "WITHHELD",
  "AVAILABLE",
  "NO_LONGER_AVAILABLE",
  "TEMPORARILY_NOT_AVAILABLE",
  "APPROVED_FOR_MARKETING",
])
const studyTypeEnum = z.enum(["INTERVENTIONAL", "OBSERVATIONAL", "EXPANDED_ACCESS"])
const sponsorTypeEnum = z.enum(["NIH", "FED", "INDUSTRY", "OTHER", "OTHER_GOV", "INDIV", "NETWORK"])
const interventionTypeEnum = z.enum([
  "DRUG",
  "DEVICE",
  "BIOLOGICAL",
  "COMBINATION_PRODUCT",
  "PROCEDURE",
  "RADIATION",
  "DIETARY_SUPPLEMENT",
  "GENETIC",
  "BEHAVIORAL",
  "DIAGNOSTIC_TEST",
  "OTHER",
])
const enrollmentTypeEnum = z.enum(["ACTUAL", "ESTIMATED"])
const designAllocationEnum = z.enum(["RANDOMIZED", "NON_RANDOMIZED", "NA"])
const designInterventionModelEnum = z.enum(["SINGLE_GROUP", "PARALLEL", "CROSSOVER", "FACTORIAL", "SEQUENTIAL"])
const designMaskingEnum = z.enum(["NONE", "SINGLE", "DOUBLE", "TRIPLE", "QUADRUPLE"])

export const TrialcoreRecordSchema = z.object({
  amassId: z.string().describe("Unique Amass identifier."),
  nctId: z.string().nullable().describe("ClinicalTrials.gov identifier (e.g. NCT01234567)."),
  briefTitle: z.string().nullable().describe("Short study title."),
  officialTitle: z.string().nullable().describe("Formal study name."),
  briefSummary: z.string().nullable(),
  acronym: z.string().nullable(),
  phase: phaseEnum.nullable(),
  overallStatus: overallStatusEnum.nullable(),
  studyType: studyTypeEnum.nullable(),
  startDate: z.string().nullable().describe("Study start (YYYY-MM-DD)."),
  completionDate: z.string().nullable().describe("Study completion (YYYY-MM-DD)."),
  lastUpdateDate: z.string().nullable().describe("Last ClinicalTrials.gov record update (YYYY-MM-DD)."),
  enrollment: z.number().nullable().describe("Participant count (actual or target)."),
  enrollmentType: enrollmentTypeEnum.nullable(),
  sponsorName: z.string().nullable(),
  sponsorType: sponsorTypeEnum.nullable(),
  collaborators: z.array(z.string()),
  conditions: z.array(z.string()).describe("Diseases / conditions studied."),
  conditionMeshTerms: z.array(z.string()),
  interventionTypes: z.array(interventionTypeEnum),
  interventionNames: z.array(z.string()),
  interventionMeshTerms: z.array(z.string()),
  facilityCountries: z.array(z.string()).describe("ISO 3166-1 alpha-2 country codes."),
  keywords: z.array(z.string()),
  orgStudyId: z.string().nullable().describe("Sponsor-assigned protocol identifier."),
  secondaryIds: z.array(z.string()).describe("Grant numbers, EudraCT IDs, etc."),
  primaryOutcomeMeasures: z.array(z.string()),
  secondaryOutcomeMeasures: z.array(z.string()),
  designAllocation: designAllocationEnum.nullable(),
  designInterventionModel: designInterventionModelEnum.nullable(),
  designPrimaryPurpose: z
    .string()
    .nullable()
    .describe("e.g. TREATMENT, PREVENTION, DIAGNOSTIC, SUPPORTIVE_CARE, SCREENING, BASIC_SCIENCE, OTHER."),
  designMasking: designMaskingEnum.nullable(),
  resultsFirstPostDate: z.string().nullable(),
  whyStopped: z.string().nullable().describe("Reason for early termination, if any."),
  isFdaRegulatedDrug: z.boolean().nullable(),
  isFdaRegulatedDevice: z.boolean().nullable(),
  armGroups: z.array(
    z.object({
      type: z.string().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  oversightHasDmc: z.boolean().nullable().describe("Whether an independent Data Monitoring Committee oversees."),
})

export type TrialcoreRecord = z.infer<typeof TrialcoreRecordSchema>

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const SearchTrialcoreRecordsInputSchema = z.object({
  query: z.string().describe("Free-text search terms.").min(1),
  phase: phaseEnum.optional().describe("Study phase."),
  overallStatus: overallStatusEnum.optional().describe("Overall recruitment / availability status."),
  studyType: studyTypeEnum.optional(),
  sponsorType: sponsorTypeEnum.optional(),
  interventionType: interventionTypeEnum.optional(),
  facilityCountries: z.string().optional().describe("Comma-separated ISO 3166-1 alpha-2 country codes (e.g. 'DE,US')."),
  hasResults: z.boolean().optional().describe("Whether trial has results posted."),
  minStartDate: z.string().regex(datePattern).optional().describe("Earliest study start (YYYY-MM-DD)."),
  maxStartDate: z.string().regex(datePattern).optional().describe("Latest study start (YYYY-MM-DD)."),
  minCompletionDate: z.string().regex(datePattern).optional().describe("Earliest completion (YYYY-MM-DD)."),
  maxCompletionDate: z.string().regex(datePattern).optional().describe("Latest completion (YYYY-MM-DD)."),
  minEnrollment: z.number().int().min(0).optional().describe("Minimum participant count."),
})

const LookupTrialcoreItemSchema = z.object({
  nctId: z.string().describe("ClinicalTrials.gov identifier (e.g. NCT01234567)."),
})

export const LookupTrialcoreAmassIdInputSchema = z.object({
  items: z.array(LookupTrialcoreItemSchema).min(1).describe("Items to resolve. Each item must specify an nctId."),
})

export const LookupTrialcoreAmassIdResultSchema = z.object({
  input: LookupTrialcoreItemSchema,
  amassIds: z.array(z.string()).describe("Matching Amass record IDs (e.g. AMTC_…)."),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
})

export type LookupTrialcoreAmassIdResult = z.infer<typeof LookupTrialcoreAmassIdResultSchema>

export const GetTrialcoreRecordByIdInputSchema = z.object({
  amassId: z.string().min(1).describe("Amass record identifier (e.g. AMTC_…)."),
})
