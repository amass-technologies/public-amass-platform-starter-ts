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

export async function runRepl(opts: { model: LanguageModel }): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true })
  const messages: ModelMessage[] = []

  console.log("Type /exit, press Ctrl+D, or press Ctrl+C twice to quit.")
  rl.on("close", () => process.exit(0))

  let armed = false
  rl.on("SIGINT", () => {
    if (armed) {
      stdout.write("\n")
      rl.close()
      return
    }
    armed = true
    rl.write(null, { ctrl: true, name: "u" })
    stdout.write(`\r\n${DIM}(Press Ctrl+C again to exit, or any other key to cancel)${RESET}\x1b[1A\x1b[3G`)
  })
  stdin.prependListener("keypress", (_str, key: { ctrl?: boolean; name?: string } | undefined) => {
    if (!armed) {
      return
    }
    if (key?.ctrl && key.name === "c") {
      return
    }
    armed = false
    stdout.write("\x1b[1B\x1b[2K\x1b[1A")
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
    try {
      const newMessages = await runTurn({
        model: opts.model,
        messages,
        onTextDelta: (s) => {
          stdout.write(s)
        },
        onToolCall: (n, a) => {
          stdout.write(`\n${DIM}→ ${n}(${JSON.stringify(a)})${RESET}\n`)
        },
        onToolResult: (n, r) => {
          const formatted = indentContinuation(formatToolResult(n, r), CONTINUATION_INDENT)
          stdout.write(`${DIM}  ↳ ${formatted}${RESET}\n`)
        },
      })
      stdout.write("\n")
      messages.push(...newMessages)
    } catch (err) {
      messages.pop()
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  rl.close()
}
