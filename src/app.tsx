import type { LanguageModel, ModelMessage } from "ai"
import { Box, Static, useApp } from "ink"
import { useEffect, useMemo, useRef, useState } from "react"
import { MAIN_SYSTEM_PROMPT, runTurn } from "./agent"
import { runCommand } from "./commands"
import { AssistantTurn, type TurnPart } from "./components/assistant-turn"
import { ErrorMessage } from "./components/error-message"
import { Prompt } from "./components/prompt"
import { UserMessage } from "./components/user-message"
import { printIntro } from "./intro"
import { buildTools } from "./tools"

type CompletedItem =
  | { type: "user"; text: string }
  | { type: "assistant"; parts: TurnPart[] }
  | { type: "error"; message: string }

export function App({ model }: { model: LanguageModel }) {
  const { exit } = useApp()
  const [completed, setCompleted] = useState<CompletedItem[]>([])
  const [activeTurn, setActiveTurn] = useState<TurnPart[] | null>(null)
  const [busy, setBusy] = useState(false)
  const messagesRef = useRef<ModelMessage[]>([])

  // Kitty keyboard protocol opt-in: enables disambiguated Shift+Enter etc.
  // Terminals that don't support it ignore the sequence.
  useEffect(() => {
    process.stdout.write("\x1b[>1u")
    return () => {
      process.stdout.write("\x1b[<u")
    }
  }, [])

  const { tools, toolFormatters } = useMemo(() => buildTools(model), [model])

  const submitTurn = async (displayText: string, modelText: string) => {
    const userMsg: ModelMessage = { role: "user", content: modelText }
    messagesRef.current = [...messagesRef.current, userMsg]
    setCompleted((c) => [...c, { type: "user", text: displayText }])
    setActiveTurn([])
    setBusy(true)

    try {
      let parts: TurnPart[] = []
      const newMessages = await runTurn({
        model,
        system: MAIN_SYSTEM_PROMPT,
        tools,
        messages: messagesRef.current,
        onTextDelta: (s) => {
          const last = parts.at(-1)
          if (last?.type === "text") {
            parts = [...parts.slice(0, -1), { type: "text", text: last.text + s }]
          } else {
            parts = [...parts, { type: "text", text: s }]
          }
          setActiveTurn(parts)
        },
        onToolCall: (id, name, args) => {
          parts = [...parts, { type: "call", entry: { id, name, args, result: null, resolved: false } }]
          setActiveTurn(parts)
        },
        onToolResult: (id, _name, result) => {
          parts = parts.map((p) =>
            p.type === "call" && p.entry.id === id
              ? { type: "call" as const, entry: { ...p.entry, result, resolved: true } }
              : p,
          )
          setActiveTurn(parts)
        },
      })
      messagesRef.current = [...messagesRef.current, ...newMessages]
      setCompleted((c) => [...c, { type: "assistant", parts }])
      setActiveTurn(null)
    } catch (err) {
      messagesRef.current.pop()
      const message = err instanceof Error ? err.message : String(err)
      setCompleted((c) => [...c, { type: "error", message }])
      setActiveTurn(null)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (display: string, modelText: string) => {
    // `display` is what the user sees in the transcript (may contain paste placeholders)
    // `modelText` is what the model receives (placeholders expanded with the actual content)
    const modelTrimmed = modelText.trim()
    if (modelTrimmed === "") {
      return
    }

    if (modelTrimmed.startsWith("/")) {
      const outcome = await runCommand(modelTrimmed, {
        exit,
        clearHistory: () => {
          // Clear visible area + scrollback, move cursor home, then re-print intro
          process.stdout.write("\x1b[2J\x1b[3J\x1b[H")
          printIntro()
          setCompleted([])
          messagesRef.current = []
        },
      })
      if (outcome.kind === "done") {
        return
      }
      if (outcome.kind === "unknown") {
        // Show the visible (display) form in the error so paste placeholders aren't expanded into terminal noise
        setCompleted((c) => [...c, { type: "error", message: `Unknown command: ${display.trim()}` }])
        return
      }
      if (outcome.kind === "error") {
        setCompleted((c) => [...c, { type: "error", message: outcome.message }])
        return
      }
      // outcome.kind === "submit"
      await submitTurn(display, outcome.modelMessage)
      return
    }

    await submitTurn(display, modelText)
  }

  return (
    <Box flexDirection="column">
      <Static items={completed}>
        {(item, i) =>
          item.type === "user" ? (
            <UserMessage key={i} text={item.text} />
          ) : item.type === "assistant" ? (
            <Box key={i} marginBottom={1}>
              <AssistantTurn parts={item.parts} formatters={toolFormatters} />
            </Box>
          ) : (
            <ErrorMessage key={i} message={item.message} />
          )
        }
      </Static>

      {activeTurn && <AssistantTurn parts={activeTurn} formatters={toolFormatters} />}

      {!busy && <Prompt onSubmit={handleSubmit} />}
    </Box>
  )
}
