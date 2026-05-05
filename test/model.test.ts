import { expect, test } from "bun:test"
import { getModel } from "../src/model"

test("getModel: rejects spec with no colon", () => {
  expect(() => getModel("anthropic")).toThrow(/Expected "provider:model-id"/)
})

test("getModel: rejects unknown provider", () => {
  expect(() => getModel("nope:something")).toThrow(/Unknown provider "nope"/)
})

test("getModel: anthropic returns a LanguageModel", () => {
  const m = getModel("anthropic:claude-opus-4-7")
  expect(m).toBeDefined()
  expect(typeof m).toBe("object")
})

test("getModel: openai returns a LanguageModel", () => {
  const m = getModel("openai:gpt-5")
  expect(m).toBeDefined()
})

test("getModel: google returns a LanguageModel", () => {
  const m = getModel("google:gemini-2.5-flash")
  expect(m).toBeDefined()
})

test("getModel: litellm returns a LanguageModel", () => {
  const m = getModel("litellm:gpt-4o")
  expect(m).toBeDefined()
})

test("getModel: model id may contain colons (e.g. bedrock-prefixed)", () => {
  const m = getModel("litellm:bedrock/anthropic.claude-3-7-sonnet:1")
  expect(m).toBeDefined()
})
