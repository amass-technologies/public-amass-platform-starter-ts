import { Box, Text } from "ink"

export function UserMessage({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <Box marginBottom={1}>
      <Text>{"> "}</Text>
      <Box flexDirection="column">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are static splits, order never changes
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  )
}
