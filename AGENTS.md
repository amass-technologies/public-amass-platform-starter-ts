# AGENTS.md

Entry point for AI assistants (Claude Code, Codex, Cursor, etc.) working in this repo. Other agent-specific files (`CLAUDE.md`, etc.) redirect here.

## What this is

A Bun + TypeScript starter for a CLI agent built on the [Vercel AI SDK](https://sdk.vercel.ai). It ships as a biomedical research assistant using the [Amass platform](https://platform.amass.tech) (BiomedCore / TrialCore), but is designed to be forked and re-skinned — system prompt, tools, and provider are all swap-out points.

For the human-facing overview (setup, env vars, REPL controls), see [README.md](./README.md).

## Where things live

```
src/
  index.tsx              entry — banner, env check, render <App>
  app.tsx                Ink UI root + turn orchestration
  agent.ts               streamText turn loop + MAIN_SYSTEM_PROMPT
  model.ts               provider:model-id → LanguageModel
  intro.ts               cfonts banner + welcome blurb (printIntro)
  tool-formatting.ts     pure helpers for rendering tool-call results
  components/            <Prompt>, <AssistantTurn>, <ToolCall>, <UserMessage>,
                         <ErrorMessage>, <CommandSuggestions>
  commands/              slash-command registry (one file per command)
  tools/                 AI SDK tools (general/, biomedcore/, trialcore/)
  env/                   Zod-backed env loader
  lib/                   small utilities
```

## Task → doc mapping

| Task | Read |
| --- | --- |
| Add a slash command (action, prompt-template, with args) | [COMMANDS.md](./COMMANDS.md) |
| Add a tool (Amass-style or any AI SDK tool) | [TOOLS.md](./TOOLS.md) |
| Add or modify a model provider | [PROVIDERS.md](./PROVIDERS.md) |
| Understand the architecture (component tree, state model, turn lifecycle, sub-agents) | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Change the system prompt or agent personality | `src/agent.ts` (`MAIN_SYSTEM_PROMPT`) |
| Change the startup banner | `src/intro.ts` |
| Change env var schema | `src/env/index.ts` (Zod) and `.env.example` |

## Conventions

- **Bun, not Node.** Run files with `bun <file>`, install with `bun install`, scripts via `bun run <script>`. Bun loads `.env` automatically — do not add `dotenv`.
- **Biome formats and lints.** Run `bun run lint` to check, `bun run format` to fix. No semicolons, double quotes, two-space indent, trailing commas where the formatter chooses.
- **TypeScript strict mode** with `noUncheckedIndexedAccess`. `array[i]` is `T | undefined` — handle the undefined case or use `?? defaultValue`.
- **`verbatimModuleSyntax: true`.** Use `import type { ... }` for type-only imports.
- **Tool names are `snake_case`** (the model sees them).
- **Slash command names are lowercase, single word.**

## Dev-only escape hatches

- **`SKIP_ENV_VALIDATION=true`** in `.env` bypasses the Zod schema in `src/lib/environment.ts` and returns an empty env object. Useful when iterating on UI without provider keys. Never enable in production — calls into provider SDKs will then fail at the API layer instead of with a clear startup error.

## Verification before committing or claiming work is done

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # biome check
```

Both must exit 0. There is no automated test suite.

## What not to change without explicit reason

- `tsconfig.json` strict flags. They catch real bugs.
- The first-colon-only split in `src/model.ts` (`spec.indexOf(":")`). Bedrock-style model ids contain colons; a naive `split(":")` breaks them.
- `exitOnCtrlC: false` in `src/index.tsx`. The custom Ctrl+C double-press UX in `<Prompt>` depends on Ink not auto-exiting.
- The `<Static>` / `activeTurn` split in `src/app.tsx`. It's the load-bearing perf optimisation for streaming.
