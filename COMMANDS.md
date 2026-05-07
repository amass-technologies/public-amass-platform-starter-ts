# Slash commands

Slash commands are shortcuts the user can type at the REPL prompt (`/exit`, `/clear`, `/fact-check`). They appear in the autocomplete dropdown as soon as the user types `/`.

There are three kinds:

- **Action commands** — run a side effect and return (e.g. `/exit`, `/clear`).
- **Prompt commands** — take args, expand them into a specialized prompt, and submit a model turn (e.g. `/fact-check <claim>`).
- **Error commands** — surface a usage error in the transcript without doing anything else (typically returned from a prompt command when args are missing or malformed).

A single handler can return any of these outcomes by returning a `CommandResult`.

## Layout

- `src/commands/types.ts` — `Command`, `CommandContext`, and `CommandResult` interfaces
- `src/commands/<name>.ts` — one file per command
- `src/commands/index.ts` — registry, prefix matcher (autocomplete), dispatcher (`runCommand`)
- `src/app.tsx` — supplies the `CommandContext`, routes any `/...` input through `runCommand`, and acts on the returned outcome

## The handler return type

```ts
export type CommandResult =
  | { kind: "done" }                              // action command, no further work
  | { kind: "submit"; modelMessage: string }      // submit a model turn with this message
  | { kind: "error"; message: string }            // show a transcript error
```

A handler always returns one of these (sync or via Promise). The host (`app.tsx`) pattern-matches on `kind` to decide what to do.

## Adding an action command

`/exit` and `/clear` are examples. The pattern:

```ts
// src/commands/<name>.ts
import type { Command } from "./types"

export const myCommand: Command = {
  name: "mycmd",
  description: "What this command does",
  handler: (ctx, _args) => {
    // ctx provides host capabilities (exit, clearHistory, ...)
    // args is the rest of the line after the command name (raw string,
    // preserving whitespace and newlines). Empty if user gave no args.
    ctx.exit() // or whatever side effect this command does
    return { kind: "done" }
  },
}
```

The handler signature is `(ctx: CommandContext, args: string) => CommandResult | Promise<CommandResult>`. Args are passed as a single raw string so multi-line / structured input (pasted articles, code, etc.) survives intact. If you want positional tokens, do `args.split(/\s+/)` yourself.

If the handler needs a new capability, see [Adding a host capability](#adding-a-host-capability) below.

Then register it in `src/commands/index.ts`:

```ts
import { myCommand } from "./mycmd"
// ...
export const commands: Command[] = [exitCommand, clearCommand, factCheckCommand, myCommand]
```

Autocomplete and dispatch both read from this array — no other registration needed.

## Adding a prompt command (with args)

`/fact-check` is the worked example: the user types `/fact-check <claim>`, the handler wraps the claim in a specialized prompt, and the model runs the turn as if the wrapped message were a normal user message. The user sees their literal `/fact-check <claim>` in the transcript; the model sees the wrapped version.

```ts
// src/commands/fact-check.ts
import type { Command } from "./types"

const PROMPT_PREFIX = `Please fact-check the following claim or question with rigorous methodology:

1. Search BiomedCore for relevant peer-reviewed publications.
2. For clinical or treatment claims, also search TrialCore for relevant trials.
3. Cite findings using PMIDs (papers) and NCT IDs (trials).
4. Distinguish well-supported, mixed-evidence, and speculative claims.
5. Provide a final assessment.

Claim:
`

export const factCheckCommand: Command = {
  name: "fact-check",
  description: "Rigorously fact-check a claim with literature and trial citations",
  handler: (_ctx, args) => {
    const claim = args.trim()
    if (!claim) {
      return { kind: "error", message: "Usage: /fact-check <claim>" }
    }
    return { kind: "submit", modelMessage: PROMPT_PREFIX + claim }
  },
}
```

A few things to note:

- **Empty args become a usage error.** Standard CLI behavior — predictable, no silent passthrough.
- **The prefix is just a string.** No special template engine, no system-prompt manipulation. The Amass research-assistant `MAIN_SYSTEM_PROMPT` stays in effect for the turn, so all the existing tool-using guidance still applies; the wrapped message just adds task-specific methodology on top.
- **`args` is the raw text after the command name** — newlines, whitespace, and pasted content arrive intact.
- **The example above is a simplified version for illustration.** The real `/fact-check` in `src/commands/fact-check.ts` uses a much more elaborate prompt (claim extraction, parallel sub-agent delegation, critical evaluation of evidence quality). Look at the actual file for the production pattern.

### Paste handling

Large pastes (≥ 500 chars) are captured as attachments by the prompt. The user sees a placeholder like `[Pasted #1: 4823 bytes]` in their input and in the transcript; the actual content is expanded transparently before the command handler runs. Your handler always receives the full text in `args` — you don't need to know whether it came from a paste or was typed.

## Adding a host capability

If your handler needs something the existing `CommandContext` doesn't expose, extend it. `/clear` is the canonical example.

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
const outcome = await runCommand(trimmed, {
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
  handler: (ctx) => {
    ctx.clearHistory()
    return { kind: "done" }
  },
}
```

This split keeps the command module pure and the host responsible for what "clear history" actually does.

## How dispatch works

When the user submits input starting with `/`:

1. `app.tsx` expands any paste placeholders, then calls `runCommand(expanded, ctx)`
2. `runCommand` strips the leading `/`, splits on the first whitespace — the first token is the command name, everything after (preserving interior whitespace and newlines) becomes `args`
3. Looks up the command by exact name match in the registry
4. If found, calls the handler and returns the `CommandOutcome` (which is the handler's `CommandResult`, or `{ kind: "unknown" }` if the command didn't match)
5. `app.tsx` switches on `outcome.kind`:
   - `done` → nothing more to do
   - `unknown` → show "Unknown command: …" error in transcript
   - `error` → show the handler's error message in transcript
   - `submit` → call `submitTurn(displayText, outcome.modelMessage)` to run a model turn (the user's literal input becomes the displayed user message; the wrapped string is what the model sees)

## Conventions

- **Lowercase command names.** `name` is the canonical form; `/Exit` does not match `/exit`.
- **Keep handlers thin.** Logic that doesn't touch REPL state (formatting, parsing, prompt construction) lives in the command module. Logic that touches host state (history, screen, transcript) goes through a `CommandContext` capability supplied by `app.tsx`.
- **Wrap the user message, don't override the system prompt.** Prompt commands should add task-specific guidance via the user message (`modelMessage`). The system prompt stays the project's default so existing tool-using behavior is preserved.
- **Validate args in the handler, return errors as `{ kind: "error", message: ... }`.** The host displays these directly in the transcript. Don't throw.
- **Async is supported.** Handlers can return `Promise<CommandResult>`. For long-running work, surface progress via the transcript by extending `CommandContext` with something like `addSystemMessage`.
