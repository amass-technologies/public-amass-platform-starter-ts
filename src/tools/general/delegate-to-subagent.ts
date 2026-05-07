import { type LanguageModel, type ModelMessage, type ToolSet, tool } from "ai"
import { z } from "zod"
import { runTurn } from "../../agent"

const SUBAGENT_SYSTEM_PROMPT = `You are a focused subagent. The user is another AI agent that has delegated a specific task to you. Use your tools to complete the task and respond with a concise final answer — don't include conversational filler.

Sourcing discipline (non-negotiable): you operate exclusively on scientific evidence in BiomedCore (peer-reviewed publications) and TrialCore (clinical trials). Every factual claim in your response must come from records you fetched via the tools below, with explicit PMID/DOI (papers) or NCT (trials) citations. If the retrieved data does not support a claim, state that — never fall back to training knowledge or speculation.

You have access to:
- BiomedCore tools (search/lookup/get for PubMed-derived publications).
- TrialCore tools (search/lookup/get for ClinicalTrials.gov-derived trials).
- get_current_datetime for time-sensitive queries.

Workflow: when given external identifiers (PMID/DOI/NCT), use the matching lookup_ tool first, then get_…_by_id for full records. For open-ended tasks, start with a search tool.`

export function buildDelegateToSubagent(model: LanguageModel, allTools: ToolSet) {
  return tool({
    description:
      "Delegate a focused task to a subagent that runs in its own isolated context. The subagent has the same tools you have (except this one) and returns a single text response. Use this for tasks that require many tool calls or that you want to keep out of your main context — e.g., 'find and summarize the 5 largest pantoprazole RCTs'. The subagent cannot delegate further.",
    inputSchema: z.object({
      instructions: z
        .string()
        .describe("What you want the subagent to do, in plain language. Be specific about what you want back."),
    }),
    execute: async ({ instructions }) => {
      const subagentTools: ToolSet = {}
      for (const [name, t] of Object.entries(allTools)) {
        if (name !== "delegate_to_subagent") {
          subagentTools[name] = t
        }
      }

      const subagentMessages: ModelMessage[] = [{ role: "user", content: instructions }]
      const newMessages = await runTurn({
        model,
        system: SUBAGENT_SYSTEM_PROMPT,
        tools: subagentTools,
        messages: subagentMessages,
        onTextDelta: () => {},
        onToolCall: () => {},
        onToolResult: () => {},
      })

      const lastAssistant = [...newMessages].reverse().find((m) => m.role === "assistant")
      if (!lastAssistant) {
        return "Subagent produced no response."
      }

      let text = ""
      const content = lastAssistant.content
      if (typeof content === "string") {
        text = content
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "text") {
            text += part.text
          }
        }
      }

      return text.trim() || "Subagent produced no text response."
    },
  })
}

export function formatDelegateToSubagentResult(result: unknown): string {
  if (typeof result !== "string") {
    return JSON.stringify(result)
  }
  const firstLine = result.split("\n").find((l) => l.trim().length > 0) ?? result
  const MAX = 200
  const preview = firstLine.length > MAX ? `${firstLine.slice(0, MAX)}…` : firstLine
  const remaining = result.length - preview.length
  return remaining > 0 ? `${preview} … +${remaining} more chars` : preview
}
