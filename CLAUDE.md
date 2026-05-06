---
description: Project guide for the Amass platform starter — commands, architecture, tools, and Bun tooling rules.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A starter for building CLI agents on the Amass platform. It is a tiny REPL harness on top of the Vercel AI SDK (`ai` package) that streams a model turn, surfaces tool calls/results, and supports swapping providers (Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint via LiteLLM) by changing one env var.

Out of the box it ships as an Amass research assistant — BiomedCore (PubMed) and TrialCore (ClinicalTrials.gov) `search` / `lookup` / `get` tools are wired up, and the agent's system prompt instructs the model to use them.

It is intentionally minimal — not a framework. Most additions land as new tools in `src/tools/` or new providers in `src/model.ts`.

## Commands

- `bun start` (or `bun run src/index.tsx`) — launch the REPL. Requires `MODEL` (e.g. `anthropic:claude-opus-4-7`) in `.env`.
- `bun run lint` — Biome check (lint + format). `bun run format` to write fixes.
- `bun run typecheck` — `tsc --noEmit`.

REPL: type `/exit`, press Ctrl+D, or hit Ctrl+C twice to quit.

## Architecture

Four files do the work; everything else is wiring.

- `src/index.tsx` — entry. Resolves `process.env.MODEL` → `getModel(spec)` → renders `<App model={model} />` via Ink.
- `src/model.ts` — `getModel(spec)` parses `"provider:model-id"`. **The split is on the *first* colon only**, so model ids may themselves contain colons (e.g. `litellm:bedrock/anthropic.claude-3-7-sonnet:1`). Each provider branch checks for its required env var and throws a clear error if missing. To add a provider, add a `case` here.
- `src/agent.ts` — `runTurn` calls `streamText` with the registered `tools`, an Amass research-assistant `SYSTEM_PROMPT`, and `stopWhen: stepCountIs(10)`. It iterates `result.fullStream` and forwards `text-delta`, `tool-call`, and `tool-result` parts to caller-supplied callbacks, then returns the new `ModelMessage[]` from the response.
- `src/app.tsx` — Ink-based UI. Owns the message history, renders conversation turns via `<AssistantTurn>`, `<UserMessage>`, `<ErrorMessage>`, and `<Prompt>` components. Handles `/exit`, Ctrl+C double-press, and Shift+Enter multi-line input.

### Tools

Tools live in `src/tools/`, organized by Amass core:
- `general/` — utilities (e.g. `get-current-datetime`).
- `biomedcore/` — `search`, `lookup` (PMID/DOI → AMBC_ ID), `get` (by AMBC_ ID), plus shared `types.ts`.
- `trialcore/` — `search`, `lookup` (NCT → AMTC_ ID), `get` (by AMTC_ ID), plus shared `types.ts`.

Tools are AI SDK `tool()` definitions registered as values in the object exported by `src/tools/index.ts`. The object key is the tool name the model sees. The same file also exports `toolFormatters` — a parallel map of `(result) => string` renderers used only by the REPL to pretty-print tool output. The agent itself sees the raw object.

```ts
// src/tools/index.ts
import { getCurrentDatetime } from "./general/get-current-datetime"
export const tools = {
  get_current_datetime: getCurrentDatetime,
  // ...
}
```

Each tool file exports a single `tool({ description, inputSchema: z.object({...}), execute })`. To add a tool: create the file under the appropriate subdirectory, register it in `src/tools/index.ts`, and (optionally) add a formatter to `toolFormatters` alongside it.

## Bun (tooling rules)

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
