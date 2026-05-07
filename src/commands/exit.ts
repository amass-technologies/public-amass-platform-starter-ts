import type { Command } from "./types"

export const exitCommand: Command = {
  name: "exit",
  description: "Quit the REPL",
  handler: (ctx) => {
    ctx.exit()
    return { kind: "done" }
  },
}
