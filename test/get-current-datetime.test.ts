import { expect, test } from "bun:test"
import { getCurrentDatetime } from "../src/tools/get-current-datetime"

test("get_current_datetime: description mentions ISO 8601", () => {
  expect(getCurrentDatetime.description).toContain("ISO 8601")
})

test("get_current_datetime: execute returns ISO 8601 timestamp", async () => {
  const execute = getCurrentDatetime.execute
  if (!execute) {
    throw new Error("expected execute to be defined")
  }
  const result = await execute({}, { toolCallId: "test", messages: [] })
  expect(typeof result).toBe("string")
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
})

test("get_current_datetime: result parses to a valid Date close to now", async () => {
  const execute = getCurrentDatetime.execute
  if (!execute) {
    throw new Error("expected execute to be defined")
  }
  const result = await execute({}, { toolCallId: "test", messages: [] })
  const parsed = new Date(result as string)
  expect(Number.isNaN(parsed.getTime())).toBe(false)
  expect(Math.abs(Date.now() - parsed.getTime())).toBeLessThan(5_000)
})
