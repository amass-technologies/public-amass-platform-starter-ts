import { Box, Text } from "ink"
import { CONTINUATION_INDENT, formatToolResult, indentContinuation } from "../tool-formatting"
import type { ToolResultFormatter } from "../tools"

export type CallEntry = {
  id: string
  name: string
  args: unknown
  result: unknown
  resolved: boolean
}

function entryBody(entry: CallEntry, formatters: Record<string, ToolResultFormatter>): string {
  if (!entry.resolved) {
    return "…"
  }
  return indentContinuation(formatToolResult(entry.name, entry.result, formatters), CONTINUATION_INDENT)
}

export function ToolCall({ entry, formatters }: { entry: CallEntry; formatters: Record<string, ToolResultFormatter> }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        → {entry.name}({JSON.stringify(entry.args)})
      </Text>
      <Text dimColor> ↳ {entryBody(entry, formatters)}</Text>
    </Box>
  )
}
