import { clearCommand } from "./clear"
import { exitCommand } from "./exit"
import type { Command, CommandContext } from "./types"

export type { Command, CommandContext } from "./types"

export const commands: Command[] = [exitCommand, clearCommand]

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

export async function runCommand(input: string, ctx: CommandContext): Promise<boolean> {
  if (!input.startsWith("/")) {
    return false
  }
  const trimmed = input.slice(1).trim()
  if (!trimmed) {
    return false
  }
  const [name, ...args] = trimmed.split(/\s+/)
  const cmd = commands.find((c) => c.name === name)
  if (!cmd) {
    return false
  }
  await cmd.handler(ctx, args)
  return true
}
