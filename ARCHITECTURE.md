# Architecture

A tour of the codebase, in roughly the order things execute. Aimed at someone who has cloned the repo and wants to understand or extend the internals.

## The three layers

```
┌─────────────────────────────────────────────────────────┐
│  UI (Ink, React for terminals)                          │
│  src/index.tsx, src/app.tsx, src/components/            │
├─────────────────────────────────────────────────────────┤
│  Agent loop (Vercel AI SDK)                             │
│  src/agent.ts, src/model.ts                             │
├─────────────────────────────────────────────────────────┤
│  Tools and commands                                     │
│  src/tools/, src/commands/                              │
└─────────────────────────────────────────────────────────┘
```

The UI knows nothing about the Amass API or specific providers. The agent loop knows nothing about Ink or terminal rendering. Tools are stateless adapters to external APIs. This separation is deliberate so any layer can be swapped (rebrand the UI, change provider, replace the toolset) without touching the others.

## Startup

`src/index.tsx` is the entry. In order:

1. Print the cfonts banner + welcome blurb (`printIntro()` from `src/intro.ts`).
2. Read `MODEL` from env. Throw a clear error if missing.
3. Resolve the model spec → AI SDK `LanguageModel` via `getModel(spec)` (`src/model.ts`). See [PROVIDERS.md](./PROVIDERS.md).
4. Hand off to Ink: `render(<App model={model} />, { exitOnCtrlC: false })`.

`exitOnCtrlC: false` is important — Ink's default would intercept Ctrl+C and exit immediately, but we want our custom double-press-to-confirm UX (handled by `<Prompt>`).

## The component tree

```
<App>                                  src/app.tsx
├─ <Static items={completed}>          past turns, frozen to scrollback
│   └─ <UserMessage> | <AssistantTurn> | <ErrorMessage>
├─ <AssistantTurn parts={activeTurn}>  the in-progress turn (live)
└─ <Prompt onSubmit={...}>             multi-line input (only when !busy)
    └─ <CommandSuggestions>            slash-command autocomplete dropdown
```

### Why the `<Static>` / `activeTurn` split

Ink's `<Static>` is a special container: items inside are rendered once and committed to terminal scrollback. It never re-renders them. Everything outside `<Static>` is the "live area" — it can re-render on every state change.

For a streaming agent UI, you want both:

- Past turns must not re-render on every text-delta of the next turn (that would be O(n²) over conversation length and the screen would flicker).
- The current turn must re-render every time a delta arrives.

So `completed` (state) goes into `<Static>` and `activeTurn` (state) renders live. When a turn finishes, the live `activeTurn` is committed into `completed` and `activeTurn` becomes `null`.

### State model

```ts
type CallEntry = { id, name, args, result, resolved }     // a tool call
type TurnPart = { type: "text"; text } | { type: "call"; entry: CallEntry }
type CompletedItem =
  | { type: "user"; text }
  | { type: "assistant"; parts: TurnPart[] }
  | { type: "error"; message }
```

`<App>` holds:

- `completed: CompletedItem[]` — render list (state)
- `activeTurn: TurnPart[] | null` — live streaming turn (state)
- `busy: boolean` — gates the prompt visibility (state)
- `messagesRef: ModelMessage[]` — the full conversation history sent to the model (ref, not state — doesn't drive rendering, accessed synchronously by callbacks)

## A turn, end to end

User submits text via `<Prompt>`. `<App>`'s `handleSubmit(display, model)` runs:

1. **Slash command path** (input starts with `/`):
   - `runCommand(model, ctx)` parses `/<name> <args>` and dispatches via the registry in `src/commands/`.
   - The handler returns one of: `{ kind: "done" }` (action command), `{ kind: "submit", modelMessage }` (prompt command), `{ kind: "error", message }`, or `{ kind: "unknown" }` (no match).
   - For `submit`, `submitTurn(display, modelMessage)` runs the model turn with the wrapped message. The user sees their literal `/foo …` in the transcript; the model sees the wrapped version.
   - See [COMMANDS.md](./COMMANDS.md) for adding commands.

2. **Regular text path**:
   - `submitTurn(display, model)` runs directly. `display === model` here unless the input contained paste placeholders (see "Paste handling" below).

`submitTurn` is the streaming machinery:

1. Append the user message to `messagesRef.current` and `completed`.
2. Initialize `parts: TurnPart[] = []` (the in-flight turn).
3. Set `busy = true` (hides the prompt).
4. Call `runTurn` from `src/agent.ts` with three callbacks: `onTextDelta`, `onToolCall`, `onToolResult`. Each callback updates both the local `parts` and `setActiveTurn(parts)` so the UI re-renders.
5. On success, append response messages to history and commit `parts` into `completed` (assistant turn moves into `<Static>`).
6. On error, pop the just-added user message from history and append an `{ type: "error" }` `CompletedItem`. The transcript shows the error inline rather than printing to stderr.
7. Set `busy = false` (prompt re-appears).

### `runTurn` (src/agent.ts)

A thin wrapper over the AI SDK's `streamText`. It:

- Streams the model response with `stopWhen: stepCountIs(10)` (the model can call tools up to 10 times per turn).
- Iterates `result.fullStream` and forwards `text-delta` / `tool-call` / `tool-result` parts to the caller's callbacks.
- Returns the new `ModelMessage[]` to append to history.

The system prompt (`MAIN_SYSTEM_PROMPT`) is also exported here. To rebrand for a non-biomedical domain, this is the file to edit.

## Tools

See [TOOLS.md](./TOOLS.md). The model sees `tools` (`src/tools/index.ts`); the REPL uses `toolFormatters` to pretty-print results inline. Tool results are *not* expanded into the model's context as text — they're structured data the model consumes directly.

## Sub-agents

`delegate_to_subagent` (`src/tools/general/delegate-to-subagent.ts`) lets the main agent spawn a focused sub-agent with isolated context. The sub-agent inherits all tools *except* `delegate_to_subagent` itself (no recursion). Use cases:

- Long-running searches whose intermediate state would clog the main context.
- Per-claim fact-checking (the `/fact-check` command relies on this — see `src/commands/fact-check.ts`).

The sub-agent runs synchronously from the main agent's perspective: one `runTurn` call internally, returning the assistant's final text response as a single string. The user sees it as one tool call card in the REPL.

## Slash commands

See [COMMANDS.md](./COMMANDS.md). High-level: `src/commands/index.ts` is a registry consumed by:

- `<Prompt>` for autocomplete (the dropdown that appears when you type `/`)
- `<App>`'s `handleSubmit` for dispatch (`runCommand`)

Commands return discriminated `CommandResult`s; `<App>` pattern-matches on `kind` to decide what to do (just return / show error / submit a model turn).

## The custom `<Prompt>` component

`src/components/prompt.tsx` is the most non-trivial UI component. It's a multi-line input with several behaviors that don't come for free in Ink:

- **Cursor management** over a `lines: string[]` buffer with `(row, col)` cursor.
- **Multi-line input**: Shift+Enter or Ctrl+J inserts a newline; Enter submits.
- **Kitty keyboard protocol opt-in** (in `<App>`, not the prompt) so terminals like Warp send disambiguated `Shift+Enter`.
- **Paste handling**: pastes ≥ 500 bytes are captured as `[Pasted #N: <bytes> bytes]` placeholders. The user sees the placeholder; the model sees the full content. Stdin chunks for the same paste are coalesced via a 100ms idle timer.
- **Slash-command autocomplete**: when the input starts with `/` and is single-line, a dropdown shows matching commands. Up/down navigates, Tab/right-arrow accepts, Enter accepts and submits.
- **Ctrl+C double-press to exit**, with a transient hint after the first press.
- **Ctrl+D on empty buffer** also exits.

`<Prompt>` calls `onSubmit(display, model)` with two arguments: what the user sees in the transcript (with paste placeholders) vs. what the model receives (placeholders expanded).

## Configuration

`src/env/index.ts` defines a Zod schema for required and optional env vars, validated on import. The schema is the single source of truth for "what environment does this app need." Add new vars there before referencing them anywhere else.

`src/lib/environment.ts` is the thin Zod-backed loader.

## Files not in any of the above categories

- `src/intro.ts` — `printIntro()` writes the cfonts banner + welcome blurb to stdout. Called once at startup and again by `/clear` (which writes a screen-clear escape and re-prints).
- `src/tool-formatting.ts` — pure helpers (`formatToolResult`, `truncatedJSON`, `indentContinuation`, `CONTINUATION_INDENT`) used by `<ToolCall>` to render a tool result. Live here rather than in the component because they're testable without React.

## Bun

Bun is the default runtime: `bun start` runs `src/index.tsx` directly (no transpile step) and `bun install` for deps. `tsconfig.json` is set up for Bun (`"types": ["bun"]`), but the code is plain TypeScript — Node should also work with a transpiler.
