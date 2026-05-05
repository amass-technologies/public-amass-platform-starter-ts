import { stdin, stdout } from "node:process"
import * as readline from "node:readline/promises"
import type { LanguageModel, ModelMessage } from "ai"
import { runTurn } from "./agent"
import { toolFormatters } from "./tools"

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

function formatToolResult(name: string, result: unknown): string {
  if (typeof result === "string") {
    return result
  }
  const formatter = toolFormatters[name]
  return formatter ? formatter(result) : truncatedJSON(result)
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

function entryBody(e: CallEntry): string {
  return e.resolved ? indentContinuation(formatToolResult(e.name, e.result), CONTINUATION_INDENT) : "…"
}

function renderEntry(e: CallEntry): string {
  return `${DIM}→ ${e.name}(${JSON.stringify(e.args)})${RESET}\n${DIM}  ↳ ${entryBody(e)}${RESET}\n`
}

function entryLineCount(e: CallEntry): number {
  return 1 + entryBody(e).split("\n").length
}

export async function runRepl(opts: { model: LanguageModel }): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true })
  const messages: ModelMessage[] = []

  console.log("Type /exit, press Ctrl+D, or press Ctrl+C twice to quit.\n")
  rl.on("close", () => process.exit(0))

  let armed = false
  rl.on("SIGINT", () => {
    if (armed) {
      stdout.write("\n")
      rl.close()
      return
    }
    armed = true
    stdout.write(`\x1b7\n${DIM}(Press Ctrl+C again to exit, or any other key to cancel)${RESET}\x1b8`)
  })
  stdin.prependListener("keypress", (_str, key: { ctrl?: boolean; name?: string } | undefined) => {
    if (!armed) {
      return
    }
    if (key?.ctrl && key.name === "c") {
      return
    }
    armed = false
    stdout.write("\x1b7\n\x1b[2K\x1b8")
  })

  while (true) {
    const line = (await rl.question("> ")).trim()
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
          stdout.write(renderEntry(entry))
          batchLineCount += entryLineCount(entry)
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
            stdout.write(renderEntry(e))
            newCount += entryLineCount(e)
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
  rl.close()
}
