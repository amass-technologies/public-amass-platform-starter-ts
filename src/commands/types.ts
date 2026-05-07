export type CommandContext = {
  exit: () => void
  clearHistory: () => void
}

export type CommandResult =
  | { kind: "done" }
  | { kind: "submit"; modelMessage: string }
  | { kind: "error"; message: string }

export type Command = {
  name: string
  description: string
  handler: (ctx: CommandContext, args: string) => CommandResult | Promise<CommandResult>
}
