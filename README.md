# Amass Platform Starter (TypeScript)

<img width="826" height="439" alt="CleanShot 2026-05-07 at 17 04 15" src="https://github.com/user-attachments/assets/54a2271b-e936-4f92-9654-1699885e98e9" />

Join the [Amass Developer Community on Discord](https://discord.com/invite/sEGaBHMhWa).

A small REPL-based research-assistant CLI built on the [Vercel AI SDK](https://sdk.vercel.ai) and the [Amass platform](https://platform.amass.tech). It streams a model turn, surfaces tool calls and results inline, supports multi-line input with paste handling, slash commands with autocomplete, and sub-agent delegation.

Out of the box it ships as a biomedical research assistant — BiomedCore (PubMed) and TrialCore (ClinicalTrials.gov) `search` / `lookup` / `get` tools are wired up. It's intentionally minimal: a starter, not a framework. Fork it, change the system prompt and tools, ship a different agent.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- An Amass API key for the default tools — sign up at the [Amass Platform](https://platform.amass.tech)
- An API key for at least one model provider (Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint via [LiteLLM](https://docs.litellm.ai))

## Setup

```bash
bun install
cp .env.example .env
# fill in the keys you need
bun start
```

`.env` recognises:

| Variable | Required | Notes |
| --- | --- | --- |
| `AMASS_API_KEY` | yes | Used by every BiomedCore / TrialCore tool. |
| `MODEL` | yes | `provider:model-id` (see below). |
| `ANTHROPIC_API_KEY` | if `MODEL=anthropic:…` | |
| `OPENAI_API_KEY` | if `MODEL=openai:…` | |
| `GOOGLE_GENERATIVE_AI_API_KEY` | if `MODEL=google:…` | |
| `LITELLM_BASE_URL`, `LITELLM_API_KEY` | if `MODEL=litellm:…` | Any OpenAI-compatible endpoint. |

Bun loads `.env` automatically — no `dotenv` needed.

## Picking a model

```bash
MODEL=anthropic:claude-opus-4-7      bun start
MODEL=openai:gpt-5                   bun start
MODEL=google:gemini-2.5-flash        bun start
MODEL=litellm:gpt-4.1-mini           bun start
```

Adding a new provider is ~5 lines in `src/model.ts` — see [PROVIDERS.md](./PROVIDERS.md).

## REPL controls

- Type a question, press Enter to send.
- **Shift+Enter** (or **Ctrl+J**) inserts a newline.
- **`/`** opens the slash-command autocomplete. Built-in: `/exit`, `/clear`, `/fact-check <text>`.
- **Ctrl+D** on an empty prompt, or **Ctrl+C twice**, also quits.
- **Pasting large text** is supported — pastes ≥ 500 bytes appear as `[Pasted #N: <bytes> bytes]` placeholders in the prompt, with the full content sent to the model.

## Scripts

| Command | What it does |
| --- | --- |
| `bun start` | Launch the REPL. |
| `bun run lint` | Biome check (lint + format). |
| `bun run format` | Apply Biome formatting fixes. |
| `bun run typecheck` | `tsc --noEmit`. |

## Customising

Most additions are mechanical. Pick the right doc:

- **Add a slash command** → [COMMANDS.md](./COMMANDS.md)
- **Add a tool** (or replace the Amass tools entirely) → [TOOLS.md](./TOOLS.md)
- **Add a model provider** → [PROVIDERS.md](./PROVIDERS.md)
- **Understand the architecture in depth** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Change the system prompt / agent personality** → `src/agent.ts`
- **Change the startup banner** → `src/intro.ts`

For AI assistants working in this repo, [AGENTS.md](./AGENTS.md) is the entry point.

## Project layout

```
src/
  index.tsx              entry — banner, env check, render <App>
  app.tsx                Ink UI root, runTurn orchestration
  agent.ts               streamText turn loop + system prompt
  model.ts               provider:model-id → LanguageModel
  intro.ts               banner / welcome blurb
  tool-formatting.ts     pure helpers for rendering tool results
  components/            Ink components (Prompt, AssistantTurn, ToolCall, ...)
  commands/              slash-command registry
  tools/                 AI SDK tools (BiomedCore, TrialCore, general)
  env/                   Zod-backed env loader
  lib/                   small utilities
```

## License

Apache 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
