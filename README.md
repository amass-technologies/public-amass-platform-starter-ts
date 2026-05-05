# Amass Platform Starter (TypeScript)

A tiny REPL-based research assistant CLI, built on top of the [Vercel AI SDK](https://sdk.vercel.ai) and the [Amass platform](https://platform.amass.tech). Out of the box it exposes BiomedCore (PubMed) and TrialCore (ClinicalTrials.gov) search/lookup/get tools to a model of your choice.

It is intentionally minimal — a starter, not a framework. Add tools under `src/tools/` and providers in `src/model.ts`.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- An Amass API key — sign up at [Amass Platform](https://platform.amass.tech)
- An API key for at least one model provider (Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint via [LiteLLM](https://docs.litellm.ai))

## Setup

Install dependencies:

```bash
bun install
```

Copy the example env file and fill in the keys you need:

```bash
cp .env.example .env
```

`.env` recognises:

| Variable | Required | Notes |
| --- | --- | --- |
| `AMASS_API_KEY` | yes | Used by every BiomedCore / TrialCore tool. |
| `MODEL` | yes | `provider:model-id` (see below). |
| `ANTHROPIC_API_KEY` | if `MODEL=anthropic:…` | |
| `OPENAI_API_KEY` | if `MODEL=openai:…` | |
| `GOOGLE_GENERATIVE_AI_API_KEY` | if `MODEL=google:…` | |
| `LITELLM_BASE_URL`, `LITELLM_API_KEY` | if `MODEL=litellm:…` | Any OpenAI-compatible endpoint works. |

Bun loads `.env` automatically — no `dotenv` needed.

## Running

```bash
bun start
```

The `MODEL` env var picks the provider and model, parsed on the *first* colon only (so model ids may themselves contain colons):

```bash
MODEL=anthropic:claude-opus-4-7      bun start
MODEL=openai:gpt-5                   bun start
MODEL=google:gemini-2.5-flash        bun start
MODEL=litellm:gpt-4.1-mini           bun start
```

### REPL controls

- Type a question, press Enter.
- `/exit`, `Ctrl+D`, or `Ctrl+C` twice to quit.

## Scripts

| Command | What it does |
| --- | --- |
| `bun start` | Launch the REPL. |
| `bun run lint` | Biome lint + format check. |
| `bun run format` | Apply Biome formatting fixes. |
| `bun run typecheck` | `tsc --noEmit`. |

## Project layout

```
index.ts             entry — reads MODEL, starts the REPL
src/model.ts         provider:model-id → LanguageModel
src/agent.ts         streamText turn loop, system prompt, tool wiring
src/repl.ts          readline REPL, history, tool-result rendering
src/tools/
  general/           generic utilities (e.g. get_current_datetime)
  biomedcore/        search / lookup / get for PubMed-derived records
  trialcore/         search / lookup / get for ClinicalTrials.gov-derived records
  index.ts           tool + formatter registry
```

To add a tool: drop a file under the appropriate `src/tools/<core>/` directory exporting a single `tool({...})`, then register it (and optionally a result formatter) in `src/tools/index.ts`.

To add a provider: add a `case` to the `switch` in `src/model.ts`.
