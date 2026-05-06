import { stdout } from "node:process"
import type { LanguageModel, ModelMessage } from "ai"
import { MAIN_SYSTEM_PROMPT, runTurn } from "./agent"
import { createPromptReader } from "./prompt"
import { buildTools, type ToolResultFormatter } from "./tools"

const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const CONTINUATION_INDENT = "    "

const MAX_STR_LEN = 120
const MAX_ARRAY_ITEMS = 3
const MAX_DEPTH = 8

function shrink(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "…"
  }
  if (typeof value === "string") {
    return value.length > MAX_STR_LEN ? `${value.slice(0, MAX_STR_LEN)}…` : value
  }
  if (Array.isArray(value)) {
    const head: unknown[] = value.slice(0, MAX_ARRAY_ITEMS).map((v) => shrink(v, depth + 1))
    if (value.length > MAX_ARRAY_ITEMS) {
      head.push(`… +${value.length - MAX_ARRAY_ITEMS} more`)
    }
    return head
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = shrink(v, depth + 1)
    }
    return out
  }
  return value
}

function truncatedJSON(value: unknown): string {
  return JSON.stringify(shrink(value), null, 2)
}

function formatToolResult(name: string, result: unknown, formatters: Record<string, ToolResultFormatter>): string {
  const formatter = formatters[name]
  if (formatter) {
    return formatter(result)
  }
  if (typeof result === "string") {
    return result
  }
  return truncatedJSON(result)
}

function indentContinuation(s: string, indent: string): string {
  return s.split("\n").join(`\n${indent}`)
}

type CallEntry = {
  id: string
  name: string
  args: unknown
  result: unknown
  resolved: boolean
}

function entryBody(e: CallEntry, formatters: Record<string, ToolResultFormatter>): string {
  return e.resolved ? indentContinuation(formatToolResult(e.name, e.result, formatters), CONTINUATION_INDENT) : "…"
}

function renderEntry(e: CallEntry, formatters: Record<string, ToolResultFormatter>): string {
  return `${DIM}→ ${e.name}(${JSON.stringify(e.args)})${RESET}\n${DIM}  ↳ ${entryBody(e, formatters)}${RESET}\n`
}

function entryLineCount(e: CallEntry, formatters: Record<string, ToolResultFormatter>): number {
  return 1 + entryBody(e, formatters).split("\n").length
}

export async function runRepl(opts: { model: LanguageModel }): Promise<void> {
  const messages: ModelMessage[] = []
  const { tools, toolFormatters } = buildTools(opts.model)

  console.log("Type /exit, press Ctrl+D, or press Ctrl+C twice to quit.\n")

  const reader = createPromptReader()

  while (true) {
    const result = await reader.prompt("> ")
    if (result.intent === "exit") {
      break
    }
    const line = result.value.trim()
    if (line === "") {
      continue
    }
    if (line === "/exit") {
      break
    }

    messages.push({ role: "user", content: line })
    let batch: CallEntry[] = []
    let batchLineCount = 0
    let suppressNextBatchLead = false
    try {
      const newMessages = await runTurn({
        model: opts.model,
        system: MAIN_SYSTEM_PROMPT,
        tools,
        messages,
        onTextDelta: (s) => {
          stdout.write(s)
          if (s.length > 0) {
            suppressNextBatchLead = false
          }
        },
        onToolCall: (id, name, args) => {
          if (batch.length === 0) {
            if (!suppressNextBatchLead) {
              stdout.write("\n")
            }
            suppressNextBatchLead = false
          }
          const entry: CallEntry = { id, name, args, result: null, resolved: false }
          batch.push(entry)
          stdout.write(renderEntry(entry, toolFormatters))
          batchLineCount += entryLineCount(entry, toolFormatters)
        },
        onToolResult: (id, _name, result) => {
          const entry = batch.find((e) => e.id === id)
          if (!entry) {
            return
          }
          entry.result = result
          entry.resolved = true

          if (batchLineCount > 0) {
            stdout.write(`\x1b[${batchLineCount}A\r\x1b[0J`)
          }
          let newCount = 0
          for (const e of batch) {
            stdout.write(renderEntry(e, toolFormatters))
            newCount += entryLineCount(e, toolFormatters)
          }
          batchLineCount = newCount

          if (batch.every((e) => e.resolved)) {
            stdout.write("\n")
            batch = []
            batchLineCount = 0
            suppressNextBatchLead = true
          }
        },
      })
      stdout.write("\n\n")
      messages.push(...newMessages)
    } catch (err) {
      messages.pop()
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  reader.close()
}
