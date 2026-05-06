export type CommandContext = {
  exit: () => void
  clearHistory: () => void
}

export type Command = {
  name: string
  description: string
  handler: (ctx: CommandContext, args: string[]) => void | Promise<void>
}
