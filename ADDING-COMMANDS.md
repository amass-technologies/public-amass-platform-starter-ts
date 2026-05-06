# Adding slash commands

Slash commands are shortcuts the user can type at the REPL prompt (`/exit`, `/clear`). They appear in the autocomplete dropdown as soon as the user types `/`.

## Layout

- `src/commands/types.ts` — `Command` and `CommandContext` interfaces
- `src/commands/<name>.ts` — one file per command
- `src/commands/index.ts` — registry, prefix matcher (autocomplete), dispatcher (`runCommand`)
- `src/app.tsx` — supplies the `CommandContext` and routes any `/...` input through `runCommand`

## Adding a simple command

### 1. Create the module

Create `src/commands/<name>.ts`:

```ts
import type { Command } from "./types"

export const myCommand: Command = {
  name: "mycmd",
  description: "What this command does",
  handler: (ctx, args) => {
    // ctx provides host capabilities (exit, clearHistory, ...)
    // args is the rest of the line split on whitespace,
    // e.g. /mycmd foo bar  -> args = ["foo", "bar"]
  },
}
```

The handler signature is `(ctx: CommandContext, args: string[]) => void | Promise<void>`.

### 2. Register it

Edit `src/commands/index.ts`:

```ts
import { myCommand } from "./mycmd"
// ...
export const commands: Command[] = [exitCommand, clearCommand, myCommand]
```

Autocomplete and dispatch both read from this array — no other registration needed.

## Adding a command that needs new host capabilities

If your handler needs something the existing `CommandContext` doesn't expose, extend it. `/clear` is a worked example.

### 1. Add the capability to `CommandContext`

`src/commands/types.ts`:

```ts
export type CommandContext = {
  exit: () => void
  clearHistory: () => void  // added when /clear was introduced
}
```

### 2. Provide the implementation in `app.tsx`

In `handleSubmit`'s `runCommand` call:

```ts
const handled = await runCommand(trimmed, {
  exit,
  clearHistory: () => {
    process.stdout.write("\x1b[2J\x1b[3J\x1b[H")
    printIntro()
    setCompleted([])
    messagesRef.current = []
  },
})
```

### 3. The command module just delegates

`src/commands/clear.ts`:

```ts
import type { Command } from "./types"

export const clearCommand: Command = {
  name: "clear",
  description: "Clear conversation history and screen",
  handler: (ctx) => ctx.clearHistory(),
}
```

This split keeps the command module pure and the host responsible for what "clear history" actually does. The same handler will work whether `clearHistory` is a one-liner or a complex sequence — only the host knows.

## How dispatch works

When the user submits input starting with `/`:

1. `app.tsx` calls `runCommand(input, ctx)`
2. `runCommand` strips the leading `/`, splits on whitespace; the first token is the name, the rest become `args`
3. Looks up the command by exact name match in the registry
4. If found, calls the handler and returns `true`
5. If not found, returns `false` and `app.tsx` shows an "Unknown command" error in the transcript

## Conventions

- **Lowercase command names.** `name` is the canonical form; `/Exit` does not match `/exit`.
- **Keep handlers thin.** Logic that doesn't touch REPL state (formatting, network calls, parsing) lives in the command module. Logic that touches host state (history, screen, transcript) goes through a `CommandContext` capability supplied by `app.tsx`.
- **Async is supported.** Handlers can return `Promise<void>`. For long-running work, surface progress via the transcript by extending `CommandContext` with something like `addSystemMessage`.
