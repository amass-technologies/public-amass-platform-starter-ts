import { Box, Text, useApp, useInput } from "ink"
import { useState } from "react"
import { matchCommands } from "../commands"
import { CommandSuggestions } from "./command-suggestions"

function renderLineWithCursor(line: string, cursorCol: number) {
  if (cursorCol < 0) {
    return line || " "
  }
  if (cursorCol >= line.length) {
    return (
      <>
        {line}
        <Text inverse> </Text>
      </>
    )
  }
  return (
    <>
      {line.slice(0, cursorCol)}
      <Text inverse>{line[cursorCol]}</Text>
      {line.slice(cursorCol + 1)}
    </>
  )
}

export function Prompt({ onSubmit }: { onSubmit: (text: string) => void }) {
  const { exit } = useApp()
  const [lines, setLines] = useState<string[]>([""])
  const [row, setRow] = useState(0)
  const [col, setCol] = useState(0)
  const [armed, setArmed] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)

  const currentLine = lines[0] ?? ""
  const showSuggestions = lines.length === 1 && row === 0 && currentLine.startsWith("/")
  const matches = showSuggestions ? matchCommands(currentLine) : []
  const clampedSelected = matches.length > 0 ? Math.min(selectedSuggestion, matches.length - 1) : 0

  const completeSuggestion = () => {
    const sel = matches[clampedSelected]
    if (!sel) {
      return
    }
    const completed = `/${sel.name}`
    setLines([completed])
    setRow(0)
    setCol(completed.length)
    setSelectedSuggestion(0)
  }

  const reset = () => {
    setLines([""])
    setRow(0)
    setCol(0)
  }

  const insertNewline = () => {
    setLines((ls) => {
      const cur = ls[row] ?? ""
      const next = [...ls]
      next[row] = cur.slice(0, col)
      next.splice(row + 1, 0, cur.slice(col))
      return next
    })
    setRow((r) => r + 1)
    setCol(0)
  }

  const insertText = (text: string) => {
    if (!text) {
      return
    }
    if (text.includes("\n") || text.includes("\r")) {
      // Bracketed paste / multi-line input: split and insert as multiple lines.
      const sanitized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "  ")
      // Drop control chars except newline
      const safe = sanitized
        .split("")
        .filter((c) => c === "\n" || c >= " ")
        .join("")
      const pieces = safe.split("\n")
      setLines((ls) => {
        const cur = ls[row] ?? ""
        const before = cur.slice(0, col)
        const after = cur.slice(col)
        const first = pieces[0] ?? ""
        const last = pieces[pieces.length - 1] ?? ""
        const middle = pieces.slice(1, -1)
        const next = [...ls]
        if (pieces.length === 1) {
          next[row] = before + first + after
          return next
        }
        next[row] = before + first
        next.splice(row + 1, 0, ...middle, last + after)
        return next
      })
      const linesAdded = pieces.length - 1
      const lastLen = pieces[pieces.length - 1]?.length ?? 0
      setRow((r) => r + linesAdded)
      setCol(lastLen)
      return
    }
    const safe = text.replace(/\t/g, "  ")
    setLines((ls) => {
      const cur = ls[row] ?? ""
      const next = [...ls]
      next[row] = cur.slice(0, col) + safe + cur.slice(col)
      return next
    })
    setCol((c) => c + safe.length)
  }

  const backspace = () => {
    if (col > 0) {
      setLines((ls) => {
        const cur = ls[row] ?? ""
        const next = [...ls]
        next[row] = cur.slice(0, col - 1) + cur.slice(col)
        return next
      })
      setCol((c) => c - 1)
    } else if (row > 0) {
      const prev = lines[row - 1] ?? ""
      const cur = lines[row] ?? ""
      setLines((ls) => {
        const next = [...ls]
        next[row - 1] = prev + cur
        next.splice(row, 1)
        return next
      })
      setRow((r) => r - 1)
      setCol(prev.length)
    }
  }

  const deleteForward = () => {
    const cur = lines[row] ?? ""
    if (col < cur.length) {
      setLines((ls) => {
        const next = [...ls]
        next[row] = cur.slice(0, col) + cur.slice(col + 1)
        return next
      })
    } else if (row < lines.length - 1) {
      const nextLine = lines[row + 1] ?? ""
      setLines((ls) => {
        const next = [...ls]
        next[row] = cur + nextLine
        next.splice(row + 1, 1)
        return next
      })
    }
  }

  useInput((input, key) => {
    // Disarm Ctrl+C on any other key
    if (armed && !(key.ctrl && input === "c")) {
      setArmed(false)
    }

    // Ctrl+C: arm, then exit on second press
    if (key.ctrl && input === "c") {
      if (armed) {
        exit()
        return
      }
      setArmed(true)
      return
    }

    // Ctrl+D: exit only when buffer is empty
    if (key.ctrl && input === "d") {
      if (lines.length === 1 && (lines[0] ?? "").length === 0) {
        exit()
      }
      return
    }

    // Ctrl+J: insert newline (legacy fallback for terminals that don't disambiguate Shift+Enter)
    if (key.ctrl && input === "j") {
      insertNewline()
      return
    }

    // Enter: submit (auto-completing if suggestions are visible); Shift+Enter: newline
    if (key.return) {
      if (key.shift) {
        insertNewline()
      } else {
        const sel = matches.length > 0 ? matches[clampedSelected] : undefined
        const text = sel ? `/${sel.name}` : lines.join("\n")
        reset()
        setSelectedSuggestion(0)
        onSubmit(text)
      }
      return
    }

    // Tab: complete suggestion if visible, else insert two spaces
    if (key.tab) {
      if (matches.length > 0) {
        completeSuggestion()
      } else {
        insertText("  ")
      }
      return
    }

    // Up/Down navigate the suggestion list when visible
    if (matches.length > 0) {
      if (key.upArrow) {
        setSelectedSuggestion(Math.max(0, clampedSelected - 1))
        return
      }
      if (key.downArrow) {
        setSelectedSuggestion(Math.min(matches.length - 1, clampedSelected + 1))
        return
      }
    }

    if (key.backspace) {
      backspace()
      return
    }
    if (key.delete) {
      // In Ink's key map, key.delete means forward-delete (not backspace).
      deleteForward()
      return
    }
    if (key.leftArrow) {
      if (col > 0) {
        setCol((c) => c - 1)
      } else if (row > 0) {
        setRow((r) => r - 1)
        setCol((lines[row - 1] ?? "").length)
      }
      return
    }
    if (key.rightArrow) {
      const cur = lines[row] ?? ""
      // Right at end of buffer with suggestions visible: complete the selection.
      if (matches.length > 0 && col === cur.length && row === lines.length - 1) {
        completeSuggestion()
        return
      }
      if (col < cur.length) {
        setCol((c) => c + 1)
      } else if (row < lines.length - 1) {
        setRow((r) => r + 1)
        setCol(0)
      }
      return
    }
    if (key.upArrow) {
      if (row > 0) {
        setRow((r) => r - 1)
        setCol((c) => Math.min(c, (lines[row - 1] ?? "").length))
      }
      return
    }
    if (key.downArrow) {
      if (row < lines.length - 1) {
        setRow((r) => r + 1)
        setCol((c) => Math.min(c, (lines[row + 1] ?? "").length))
      }
      return
    }

    // Printable text (single char or paste)
    if (input && input.length > 0) {
      insertText(input)
    }
  })

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{"> "}</Text>
        <Box flexDirection="column">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are stable in order; backspace merges by removing entries
            <Text key={i}>{renderLineWithCursor(line, i === row ? col : -1)}</Text>
          ))}
        </Box>
      </Box>
      {showSuggestions && <CommandSuggestions matches={matches} selectedIndex={clampedSelected} />}
      {armed && <Text dimColor>(Press Ctrl+C again to exit, or any other key to cancel)</Text>}
    </Box>
  )
}
