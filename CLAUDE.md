---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A starter for building CLI agents on the Amass platform. It is a tiny REPL harness on top of the Vercel AI SDK (`ai` package) that streams a model turn, surfaces tool calls/results, and supports swapping providers (Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint via LiteLLM) by changing one env var.

It is intentionally minimal — not a framework. Most additions land as new tools in `src/tools/` or new providers in `src/model.ts`.

## Commands

- `bun start` (or `bun run index.ts`) — launch the REPL. Reads `MODEL` from `.env`; defaults to `anthropic:claude-opus-4-7`.
- `bun run lint` — Biome check (lint + format). `bun run format` to write fixes.
- `bun run typecheck` — `tsc --noEmit`.

REPL: type `/exit`, press Ctrl+D, or hit Ctrl+C twice to quit. A single Ctrl+C clears the current line.

## Architecture

Three files do the work; everything else is wiring.

- `index.ts` — entry. Resolves `process.env.MODEL` → `getModel(spec)` → `runRepl({ model })`.
- `src/model.ts` — `getModel(spec)` parses `"provider:model-id"`. **The split is on the *first* colon only**, so model ids may themselves contain colons (e.g. `litellm:bedrock/anthropic.claude-3-7-sonnet:1`). Each provider branch checks for its required env var and throws a clear error if missing. To add a provider, add a `case` here.
- `src/agent.ts` — `runTurn` calls `streamText` with the registered `tools` and `stopWhen: stepCountIs(10)`. It iterates `result.fullStream` and forwards `text-delta`, `tool-call`, and `tool-result` parts to caller-supplied callbacks, then returns the new `ModelMessage[]` from the response.
- `src/repl.ts` — readline-based REPL. Owns the message history (appends user input, appends `runTurn`'s returned messages on success). On error it pops the just-added user message so retries don't double-send. Tool calls and results are printed in dim ANSI inline with the streamed text.

### Tools

Tools are AI SDK `tool()` definitions registered as values in the object exported by `src/tools/index.ts`. The object key is the tool name the model sees.

```ts
// src/tools/index.ts
import { getCurrentDatetime } from "./get-current-datetime"
export const tools = {
  get_current_datetime: getCurrentDatetime,
}
```

Each tool file exports a single `tool({ description, inputSchema: z.object({...}), execute })`. To add a tool: create the file, then register it in `src/tools/index.ts`. Note that `src/tools/search-biomedcore-records.ts` exists but is **not** currently wired into the `tools` registry — register it before expecting the model to call it.

## Bun (tooling rules)

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
