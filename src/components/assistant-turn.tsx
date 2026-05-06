import { Box, Text } from "ink"
import type { ToolResultFormatter } from "../tools"
import { type CallEntry, ToolCall } from "./tool-call"

export type TurnPart = { type: "text"; text: string } | { type: "call"; entry: CallEntry }

export function AssistantTurn({
  parts,
  formatters,
}: {
  parts: TurnPart[]
  formatters: Record<string, ToolResultFormatter>
}) {
  return (
    <Box flexDirection="column">
      {parts.map((part, i) =>
        part.type === "text" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: text parts are append-only and order-stable — a text delta either appends to the last text part or pushes a new one, never reorders
          <Text key={i}>{part.text}</Text>
        ) : (
          <ToolCall key={part.entry.id} entry={part.entry} formatters={formatters} />
        ),
      )}
    </Box>
  )
}
