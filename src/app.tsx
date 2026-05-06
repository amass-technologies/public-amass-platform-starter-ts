import type { LanguageModel, ModelMessage } from "ai"
import { Box, Static, useApp } from "ink"
import { useEffect, useMemo, useRef, useState } from "react"
import { MAIN_SYSTEM_PROMPT, runTurn } from "./agent"
import { AssistantTurn, type TurnPart } from "./components/assistant-turn"
import { ErrorMessage } from "./components/error-message"
import { Prompt } from "./components/prompt"
import { UserMessage } from "./components/user-message"
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

  const handleSubmit = async (input: string) => {
    const trimmed = input.trim()
    if (trimmed === "") {
      return
    }
    if (trimmed === "/exit") {
      exit()
      return
    }

    const userMsg: ModelMessage = { role: "user", content: input }
    messagesRef.current = [...messagesRef.current, userMsg]
    setCompleted((c) => [...c, { type: "user", text: input }])
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
