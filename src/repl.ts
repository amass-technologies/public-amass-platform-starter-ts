import { stdin, stdout } from "node:process"
import * as readline from "node:readline/promises"
import type { LanguageModel, ModelMessage } from "ai"
import { runTurn } from "./agent"

const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

function formatResult(r: unknown): string {
  return typeof r === "string" ? r : JSON.stringify(r)
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
    stdout.write(
      `\r\n${DIM}(Press Ctrl+C again to exit, or any other key to cancel)${RESET}\x1b[1A\x1b[3G`,
    )
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
        onToolResult: (_n, r) => {
          stdout.write(`${DIM}  ↳ ${formatResult(r)}${RESET}\n`)
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
