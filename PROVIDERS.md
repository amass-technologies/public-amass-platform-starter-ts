# Model providers

The starter supports any LLM provider with an [AI SDK](https://sdk.vercel.ai) adapter. Out of the box: Anthropic, OpenAI, Google, and any OpenAI-compatible endpoint via [LiteLLM](https://docs.litellm.ai).

The provider is selected by the `MODEL` env var: `provider:model-id`.

```bash
MODEL=anthropic:claude-opus-4-7      bun start
MODEL=openai:gpt-5                   bun start
MODEL=google:gemini-2.5-flash        bun start
MODEL=litellm:gpt-4.1-mini           bun start
```

## How it works

`src/model.ts` exports `getModel(spec: string): LanguageModel`. It splits the spec on the **first colon only** (so the model id can itself contain colons — e.g. `litellm:bedrock/anthropic.claude-3-7-sonnet:1`), then dispatches by provider.

```ts
const sep = spec.indexOf(":")
const provider = spec.slice(0, sep)
const modelId = spec.slice(sep + 1)
switch (provider) {
  case "anthropic": /* ... */
  case "openai":    /* ... */
  case "google":    /* ... */
  case "litellm":   /* ... */
  default: throw new Error(`Unknown provider "${provider}". Known: anthropic, openai, google, litellm.`)
}
```

Each branch checks for the provider's required env var and throws a clear error if missing, then returns the AI SDK `LanguageModel`.

## Adding a new provider

Worked example: adding [xAI](https://x.ai) (Grok).

### 1. Install the SDK

```bash
bun add @ai-sdk/xai
```

### 2. Add env vars to `src/env/index.ts`

```ts
const environment = new Environment(
  z.object({
    // ...existing
    XAI_API_KEY: z.string().optional(),
  }),
)
```

### 3. Add the case to `src/model.ts`

```ts
import { xai } from "@ai-sdk/xai"
// ...

switch (provider) {
  // ...existing
  case "xai":
    if (!env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY must be set")
    }
    return xai(modelId)
  // ...
}
```

Update the `default` branch's error message to include the new provider name.

### 4. Add a placeholder to `.env.example`

```
# xAI
XAI_API_KEY=
```

### 5. Try it

```bash
MODEL=xai:grok-4 bun start
```

That's the whole loop — five steps, three files, no other code touches the model at all.

## OpenAI-compatible endpoints (LiteLLM and friends)

The `litellm` case uses `@ai-sdk/openai-compatible` with a configurable base URL. This works for any OpenAI-compatible API: a self-hosted LiteLLM proxy, an OpenRouter endpoint, a local Ollama server, etc.

```bash
LITELLM_BASE_URL=https://your-litellm-host/v1
LITELLM_API_KEY=sk-...
MODEL=litellm:gpt-4.1-mini bun start
```

If you want a separate provider name for, say, OpenRouter (just for clarity), copy the `litellm` case as `openrouter` with its own env vars rather than adding a third dimension to `MODEL`.

## Conventions

- **Provider name = the registry key only.** Lowercase, single word. Pick something that maps to the SDK package name (`anthropic` for `@ai-sdk/anthropic`, etc.).
- **Throw on missing env vars before calling the SDK constructor.** The error message names the variable so the user knows what to set.
- **Default branches must list known providers in the error message.** Helps the user diagnose typos.
- **Don't pre-instantiate clients at module load.** `getModel(spec)` is called once on startup; lazy construction in the `case` branch is what you want.

## Why first-colon-only splitting?

Bedrock-style model ids contain colons (`bedrock/anthropic.claude-3-7-sonnet:1`). A naive `spec.split(":")` would break them. `spec.indexOf(":")` followed by `slice` ensures only the leading `provider:` is consumed, the rest is passed verbatim to the SDK.
