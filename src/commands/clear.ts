import type { Command } from "./types"

export const clearCommand: Command = {
  name: "clear",
  description: "Clear conversation history and screen",
  handler: (ctx) => {
    ctx.clearHistory()
  },
}
