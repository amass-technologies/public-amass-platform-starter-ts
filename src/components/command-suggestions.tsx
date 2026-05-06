import { Box, Text } from "ink"
import type { Command } from "../commands"

export function CommandSuggestions({ matches, selectedIndex }: { matches: Command[]; selectedIndex: number }) {
  if (matches.length === 0) {
    return null
  }
  return (
    <Box flexDirection="column">
      {matches.map((cmd, i) => {
        const selected = i === selectedIndex
        return (
          <Box key={cmd.name}>
            <Text color={selected ? "cyan" : undefined} dimColor={!selected}>
              {selected ? "▶ " : "  "}/{cmd.name}
            </Text>
            <Text dimColor> — {cmd.description}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
