import { Box, Text } from "ink"
import { marked, type Tokens } from "marked"
import type { ToolResultFormatter } from "../tools"
import { type CallEntry, ToolCall } from "./tool-call"

export type TurnPart = { type: "text"; text: string } | { type: "call"; entry: CallEntry }

function Inline({ tokens }: { tokens: Tokens.Generic[] }) {
  return (
    <>
      {tokens.map((tok, i) => {
        switch (tok.type) {
          case "strong":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} bold>
                <Inline tokens={tok.tokens ?? []} />
              </Text>
            )
          case "em":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} italic>
                <Inline tokens={tok.tokens ?? []} />
              </Text>
            )
          case "codespan":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} color="cyan">
                {tok.text}
              </Text>
            )
          case "del":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} strikethrough>
                <Inline tokens={tok.tokens ?? []} />
              </Text>
            )
          case "link":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} color="blue" underline>
                <Inline tokens={tok.tokens ?? []} />
              </Text>
            )
          case "br":
            // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
            return <Text key={i}>{"\n"}</Text>
          case "text":
            return tok.tokens ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Inline key={i} tokens={tok.tokens} />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i}>{tok.text}</Text>
            )
          default:
            // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
            return <Text key={i}>{tok.raw}</Text>
        }
      })}
    </>
  )
}

function Blocks({ tokens }: { tokens: Tokens.Generic[] }) {
  return (
    <Box flexDirection="column">
      {tokens.map((tok, i) => {
        switch (tok.type) {
          case "paragraph":
          case "text":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i}>{tok.tokens ? <Inline tokens={tok.tokens} /> : (tok.text ?? "")}</Text>
            )
          case "heading":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} bold color="cyanBright">
                <Inline tokens={tok.tokens ?? []} />
              </Text>
            )
          case "list": {
            const list = tok as Tokens.List
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Box key={i} flexDirection="column">
                {list.items.map((item, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: list item order is stable for a given source
                  <Box key={j}>
                    <Text>{list.ordered ? `${(list.start || 1) + j}. ` : "• "}</Text>
                    <Box flexDirection="column" flexGrow={1}>
                      <Blocks tokens={item.tokens ?? []} />
                    </Box>
                  </Box>
                ))}
              </Box>
            )
          }
          case "blockquote":
            return (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
                key={i}
                borderStyle="single"
                borderTop={false}
                borderRight={false}
                borderBottom={false}
                paddingLeft={1}
              >
                <Blocks tokens={(tok as Tokens.Blockquote).tokens ?? []} />
              </Box>
            )
          case "code":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Box key={i} paddingX={1}>
                <Text color="gray">{(tok as Tokens.Code).text}</Text>
              </Box>
            )
          case "hr":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
              <Text key={i} dimColor>
                {"─".repeat(40)}
              </Text>
            )
          case "space":
            return null
          default:
            // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable for a given source
            return <Text key={i}>{tok.raw ?? ""}</Text>
        }
      })}
    </Box>
  )
}

function Markdown({ source }: { source: string }) {
  return <Blocks tokens={marked.lexer(source)} />
}

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
          <Markdown key={i} source={part.text} />
        ) : (
          <ToolCall key={part.entry.id} entry={part.entry} formatters={formatters} />
        ),
      )}
    </Box>
  )
}
