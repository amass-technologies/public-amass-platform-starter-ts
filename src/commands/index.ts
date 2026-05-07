import { clearCommand } from "./clear"
import { exitCommand } from "./exit"
import { factCheckCommand } from "./fact-check"
import type { Command, CommandContext, CommandResult } from "./types"

export type { Command, CommandContext, CommandResult } from "./types"

export const commands: Command[] = [exitCommand, clearCommand, factCheckCommand]

export type CommandOutcome = { kind: "unknown" } | CommandResult

export function matchCommands(input: string): Command[] {
  if (!input.startsWith("/")) {
    return []
  }
  const query = input.slice(1)
  if (query.includes(" ")) {
    return []
  }
  const lower = query.toLowerCase()
  return commands.filter((c) => c.name.toLowerCase().startsWith(lower))
}

export async function runCommand(input: string, ctx: CommandContext): Promise<CommandOutcome> {
  if (!input.startsWith("/")) {
    return { kind: "unknown" }
  }
  const stripped = input.slice(1)
  if (!stripped.trim()) {
    return { kind: "unknown" }
  }
  // First whitespace separates the command name from the rest of the line.
  // Args preserve interior whitespace and newlines verbatim.
  const match = stripped.match(/^(\S+)(?:\s+([\s\S]*))?$/)
  if (!match) {
    return { kind: "unknown" }
  }
  const name = match[1] ?? ""
  const args = match[2] ?? ""
  const cmd = commands.find((c) => c.name === name)
  if (!cmd) {
    return { kind: "unknown" }
  }
  return cmd.handler(ctx, args)
}
