# Tools

Tools are functions the model can call during a turn. They are AI SDK [`tool()`](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) definitions: a description, a Zod input schema, and an `execute` function. The model decides when to call them based on the system prompt and the user's question.

Out of the box, this starter ships:

- **BiomedCore** (`src/tools/biomedcore/`) — `search`, `lookup`, `get` against PubMed-derived publications via the Amass API.
- **TrialCore** (`src/tools/trialcore/`) — `search`, `lookup`, `get` against ClinicalTrials.gov-derived trials via the Amass API.
- **General** (`src/tools/general/`) — `get_current_datetime`, `delegate_to_subagent` (sub-agent isolation, see [ARCHITECTURE.md](./ARCHITECTURE.md)).

## Layout

```
src/tools/
  index.ts                 registry: tools + toolFormatters
  general/                 utilities not tied to an Amass core
  biomedcore/              search / lookup / get + shared types
  trialcore/               search / lookup / get + shared types
  <core>/types.ts          shared Zod schemas + TS types for that core
```

`src/tools/index.ts` exports two parallel maps:

- `tools` — the AI SDK `ToolSet` the model sees. Object key is the tool name (snake_case).
- `toolFormatters` — `(result) => string` renderers used by the REPL only, to pretty-print tool output. The model never sees these.

## Anatomy of a tool

A tool file exports a single `tool({ description, inputSchema, execute })`. The simplest possible example:

```ts
// src/tools/general/get-current-datetime.ts
import { tool } from "ai"
import { z } from "zod"

export const getCurrentDatetime = tool({
  description: "Returns the current date and time as an ISO 8601 string in UTC.",
  inputSchema: z.object({}),
  execute: async () => new Date().toISOString(),
})
```

A tool that calls an external API typically also exports a result formatter for the REPL:

```ts
// src/tools/<core>/<verb>.ts
import { tool } from "ai"
import { z } from "zod"
import env from "../../env"
import { type FooRecord, FooRecordSchema, SearchFooInputSchema } from "./types"

export const searchFoo = tool({
  description: "Plain-language description of what this does and when the model should call it.",
  inputSchema: SearchFooInputSchema,
  outputSchema: z.array(FooRecordSchema),
  execute: async (input) => {
    const res = await fetch(`${env.FOO_API_BASE_URL}/search?q=${encodeURIComponent(input.query)}`, {
      headers: { Authorization: `Bearer ${env.FOO_API_KEY}` },
    })
    if (!res.ok) {
      throw new Error(`Foo API error ${res.status}: ${await res.text()}`)
    }
    const body = (await res.json()) as { data: FooRecord[] }
    return body.data
  },
})

export function formatSearchFooResult(result: FooRecord[]): string {
  // produce a short, human-readable summary for the REPL — model never sees this
  return `${result.length} record${result.length === 1 ? "" : "s"}`
}
```

## Adding a tool — step by step

1. **Create the file** under the relevant subdirectory: `src/tools/<core>/<verb>.ts` (for a new core, make a new directory). For shared schemas/types in the same core, add them to `<core>/types.ts`.

2. **Write the tool definition.** Required: `description` (drives whether the model calls it, so be concrete about *when to use*), `inputSchema` (Zod), `execute` (async function). Optional but recommended: `outputSchema` (Zod) so the model gets structured results.

3. **Write a formatter** (optional but encouraged for non-trivial output). The REPL uses it to display tool results inline; without one, results render as truncated JSON. Keep formatter output to a few lines — it's there to give the user a peek, not the full data.

4. **Register both** in `src/tools/index.ts`:

   ```ts
   import { searchFoo, formatSearchFooResult } from "./foo/search"

   const tools: ToolSet = {
     // ...existing
     search_foo: searchFoo,
   }

   const toolFormatters: Record<string, ToolResultFormatter> = {
     // ...existing
     search_foo: formatSearchFooResult,
   }
   ```

   The object key under `tools` is the name the model uses to call the tool. Use `snake_case` consistently (the existing tools follow this).

5. **Update the system prompt** in `src/agent.ts` if the model needs guidance on when to use the new tool. The default `MAIN_SYSTEM_PROMPT` enumerates Amass tools explicitly; for a new core, add a short paragraph in the same style.

6. **Add any required env vars** to `src/env/index.ts` (Zod schema with `.optional()` if the tool isn't always loaded, or required if always). Add a placeholder line to `.env.example`.

## Conventions

- **Tool name = snake_case.** This is what the model sees. `search_biomedcore_records`, not `searchBiomedcoreRecords`.
- **Description = when, not how.** The model picks tools by description. Lead with what the tool finds and when to call it; secondary: parameters.
- **Throw on API errors** with a useful message. The AI SDK surfaces thrown errors as tool errors that the model can recover from. Don't return error sentinels.
- **Validate inputs at the schema layer.** Zod handles type coercion and bounds — your `execute` should be able to assume well-formed input.
- **Keep formatters terse.** They render dim, indented under tool-call cards; long output gets ugly. The full data is still in the model's context — formatters are just for the user to see what happened.
- **Stateless tools are easier.** If your tool needs config (an API key, a base URL), pull from `env` rather than threading it through. If it needs runtime state, you'll need to either close over it at registration time or pass it as a tool input.

## Sub-agents

`delegate_to_subagent` is a special tool that lets the main agent spin up a focused sub-agent with isolated context to handle a sub-task. Sub-agents inherit the same toolset (minus `delegate_to_subagent` itself, so they can't recurse). See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on the sub-agent flow.

## Removing or replacing the Amass tools

If you're forking this starter to build something unrelated to biomedical research, you'll likely want to:

1. Delete `src/tools/biomedcore/` and `src/tools/trialcore/` (and their imports in `src/tools/index.ts`).
2. Rewrite `MAIN_SYSTEM_PROMPT` in `src/agent.ts` to describe your new domain and tools.
3. Update `printIntro()` in `src/intro.ts` (the welcome banner is biomedical-research-themed).
4. Update `.env.example` to drop `AMASS_API_KEY` / `AMASS_API_BASE_URL`.

Everything else (Ink UI, slash commands, providers, sub-agents) is domain-neutral.
