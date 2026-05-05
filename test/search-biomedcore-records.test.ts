import { afterEach, expect, test } from "bun:test"
import { searchBiomedcoreRecords } from "../src/tools/search-biomedcore-records"

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
  const execute = searchBiomedcoreRecords.execute
  if (!execute) {
    throw new Error("expected execute to be defined")
  }
  return execute
}

test("search_biomedcore_records: description mentions BiomedCore", () => {
  expect(searchBiomedcoreRecords.description).toContain("BiomedCore")
})

test("search_biomedcore_records: throws when AMASS_API_KEY is missing", async () => {
  delete process.env.AMASS_API_KEY
  await expect(getExecute()({ query: "aspirin" }, { toolCallId: "t", messages: [] })).rejects.toThrow(/AMASS_API_KEY/)
})

test("search_biomedcore_records: sends Bearer token and encoded query params", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  let capturedUrl: string | undefined
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url
    capturedInit = init
    return new Response(JSON.stringify({ data: [{ amassId: "abc" }] }), {
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  const result = await getExecute()(
    {
      query: "GLP-1 obesity",
      minPublicationDate: "2022-01-01",
      maxPublicationDate: "2025-12-31",
      minCitationCount: 5,
      minJournalQualityJufo: 2,
      isRetracted: false,
    },
    { toolCallId: "t", messages: [] },
  )

  expect(capturedUrl).toContain("https://api.amass.tech/api/v1/cores/biomedcore/records?")
  expect(capturedUrl).toContain("query=GLP-1+obesity")
  expect(capturedUrl).toContain("limit=20")
  expect(capturedUrl).not.toContain("include=")
  expect(capturedUrl).toContain("minPublicationDate=2022-01-01")
  expect(capturedUrl).toContain("maxPublicationDate=2025-12-31")
  expect(capturedUrl).toContain("minCitationCount=5")
  expect(capturedUrl).toContain("minJournalQualityJufo=2")
  expect(capturedUrl).toContain("isRetracted=false")
  const headers = capturedInit?.headers as Record<string, string>
  expect(headers.Authorization).toBe("Bearer amass_test_key")
  expect(result).toEqual({ data: [{ amassId: "abc" }] })
})

test("search_biomedcore_records: omits optional params when not provided", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  let capturedUrl: string | undefined
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    return new Response(JSON.stringify({ data: [] }), {
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  await getExecute()({ query: "aspirin" }, { toolCallId: "t", messages: [] })

  expect(capturedUrl).toContain("https://api.amass.tech/api/v1/cores/biomedcore/records?query=aspirin&limit=20")
  expect(capturedUrl).not.toContain("minPublicationDate=")
  expect(capturedUrl).not.toContain("isRetracted=")
})

test("search_biomedcore_records: throws on non-OK response", async () => {
  process.env.AMASS_API_KEY = "amass_test_key"
  globalThis.fetch = (async () =>
    new Response("unauthorized", { status: 401, statusText: "Unauthorized" })) as typeof fetch

  await expect(getExecute()({ query: "aspirin" }, { toolCallId: "t", messages: [] })).rejects.toThrow(/401/)
})
