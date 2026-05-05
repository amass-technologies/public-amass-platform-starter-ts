import { afterEach, expect, test } from "bun:test"
import { formatSearchTrialcoreRecordsResult, searchTrialcoreRecords } from "../src/tools/search-trialcore-records"

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_KEY = process.env.AMASS_API_KEY

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_KEY === undefined) {
    delete process.env.AMASS_API_KEY
  } else {
    process.env.AMASS_API_KEY = ORIGINAL_KEY
  }
})

function getExecute() {
  const execute = searchTrialcoreRecords.execute
  if (!execute) {
    throw new Error("expected execute to be defined")
  }
  return execute
}

test("search_trialcore_records: description mentions TrialCore", () => {
  expect(searchTrialcoreRecords.description).toContain("TrialCore")
})

test("search_trialcore_records: throws when AMASS_API_KEY is missing", async () => {
  delete process.env.AMASS_API_KEY
  await expect(getExecute()({ query: "GLP-1" }, { toolCallId: "t", messages: [] })).rejects.toThrow(/AMASS_API_KEY/)
})

test("search_trialcore_records: sends Bearer token and encoded query params", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  let capturedUrl: string | undefined
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url
    capturedInit = init
    return new Response(JSON.stringify({ data: [{ nctId: "NCT00000001" }] }), {
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  const result = await getExecute()(
    {
      query: "GLP-1 obesity",
      phase: "PHASE3",
      overallStatus: "RECRUITING",
      studyType: "INTERVENTIONAL",
      sponsorType: "INDUSTRY",
      interventionType: "DRUG",
      facilityCountries: "DE,US",
      hasResults: true,
      minStartDate: "2022-01-01",
      maxStartDate: "2025-12-31",
      minCompletionDate: "2023-01-01",
      maxCompletionDate: "2027-12-31",
      minEnrollment: 100,
    },
    { toolCallId: "t", messages: [] },
  )

  expect(capturedUrl).toContain("https://api.amass.tech/api/v1/cores/trialcore/records?")
  expect(capturedUrl).toContain("query=GLP-1+obesity")
  expect(capturedUrl).toContain("limit=20")
  expect(capturedUrl).not.toContain("include=")
  expect(capturedUrl).toContain("phase=PHASE3")
  expect(capturedUrl).toContain("overallStatus=RECRUITING")
  expect(capturedUrl).toContain("studyType=INTERVENTIONAL")
  expect(capturedUrl).toContain("sponsorType=INDUSTRY")
  expect(capturedUrl).toContain("interventionType=DRUG")
  expect(capturedUrl).toContain("facilityCountries=DE%2CUS")
  expect(capturedUrl).toContain("hasResults=true")
  expect(capturedUrl).toContain("minStartDate=2022-01-01")
  expect(capturedUrl).toContain("maxStartDate=2025-12-31")
  expect(capturedUrl).toContain("minCompletionDate=2023-01-01")
  expect(capturedUrl).toContain("maxCompletionDate=2027-12-31")
  expect(capturedUrl).toContain("minEnrollment=100")
  const headers = capturedInit?.headers as Record<string, string>
  expect(headers.Authorization).toBe("Bearer amass_test_key")
  expect(result).toEqual({ data: [{ nctId: "NCT00000001" }] })
})

test("search_trialcore_records: omits optional params when not provided", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  let capturedUrl: string | undefined
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    return new Response(JSON.stringify({ data: [] }), {
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  await getExecute()({ query: "aspirin" }, { toolCallId: "t", messages: [] })

  expect(capturedUrl).toContain("https://api.amass.tech/api/v1/cores/trialcore/records?query=aspirin&limit=20")
  expect(capturedUrl).not.toContain("phase=")
  expect(capturedUrl).not.toContain("hasResults=")
  expect(capturedUrl).not.toContain("minStartDate=")
})

test("search_trialcore_records: throws on non-OK response", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  globalThis.fetch = (async () =>
    new Response("unauthorized", { status: 401, statusText: "Unauthorized" })) as typeof fetch

  await expect(getExecute()({ query: "aspirin" }, { toolCallId: "t", messages: [] })).rejects.toThrow(/401/)
})

test("search_trialcore_records: formatter renders header, records, and overflow", () => {
  const sample = {
    data: [
      {
        nctId: "NCT00000001",
        phase: "PHASE3",
        overallStatus: "RECRUITING",
        studyType: "INTERVENTIONAL",
        enrollment: 450,
        briefTitle: "A study of drug X for obesity",
        sponsorName: "ACME Pharma",
        sponsorType: "INDUSTRY",
        interventionNames: ["drug-x", "placebo"],
        conditions: ["Obesity", "Diabetes"],
      },
      {
        nctId: "NCT00000002",
        phase: "PHASE2",
        overallStatus: "COMPLETED",
        studyType: "INTERVENTIONAL",
        enrollment: 80,
        briefTitle: "B trial",
        sponsorName: "Univ Hospital",
        sponsorType: "OTHER",
        interventionNames: [],
        conditions: ["Cancer"],
      },
      { nctId: "NCT00000003", briefTitle: "C", interventionNames: [], conditions: [] },
      { nctId: "NCT00000004", briefTitle: "D", interventionNames: [], conditions: [] },
    ],
  }
  const out = formatSearchTrialcoreRecordsResult(sample)
  expect(out).toContain("4 trials")
  expect(out).toContain("NCT00000001")
  expect(out).toContain("PHASE3")
  expect(out).toContain("RECRUITING")
  expect(out).toContain("n=450")
  expect(out).toContain("ACME Pharma (INDUSTRY)")
  expect(out).toContain("int: drug-x, placebo")
  expect(out).toContain("cond: Obesity, Diabetes")
  expect(out).toContain("… +1 more")
  expect(out).not.toContain("NCT00000004")
})
