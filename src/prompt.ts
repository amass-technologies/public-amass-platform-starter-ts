import { stdin, stdout } from "node:process"

const ENABLE_BRACKETED_PASTE = "\x1b[?2004h"
const DISABLE_BRACKETED_PASTE = "\x1b[?2004l"
const PASTE_START = "\x1b[200~"
const PASTE_END = "\x1b[201~"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

export type PromptResult = { value: string; intent: "submit" | "exit" }

export interface PromptReader {
  prompt(promptText: string): Promise<PromptResult>
  close(): void
}

function visualRows(charCount: number, width: number): number {
  if (charCount === 0) {
    return 1
  }
  return Math.ceil(charCount / width)
}

function visibleLength(s: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes
  return s.replace(/\x1b\[[\d;]*[A-Za-z]/g, "").length
}

export function createPromptReader(): PromptReader {
  if (!stdin.isTTY) {
    throw new Error("createPromptReader requires a TTY")
  }

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding("utf8")
  stdout.write(ENABLE_BRACKETED_PASTE)

  let active: ((data: string) => void) | null = null
  const masterListener = (data: string) => {
    active?.(data)
  }
  stdin.on("data", masterListener)

  const close = () => {
    stdin.removeListener("data", masterListener)
    stdout.write(DISABLE_BRACKETED_PASTE)
    if (stdin.isTTY) {
      stdin.setRawMode(false)
    }
    stdin.pause()
  }

  return {
    close,
    prompt: (promptText) =>
      new Promise<PromptResult>((resolve) => {
        const lines: string[] = [""]
        let row = 0
        let col = 0
        let inPaste = false
        let lastTargetRow = 0
        let armed = false
        let hintShown = false
        const promptWidth = visibleLength(promptText)

        const width = () => stdout.columns ?? 80

        const showHint = () => {
          if (hintShown) {
            return
          }
          hintShown = true
          stdout.write(`\x1b7\n${DIM}(Press Ctrl+C again to exit, or any other key to cancel)${RESET}\x1b8`)
        }
        const hideHint = () => {
          if (!hintShown) {
            return
          }
          hintShown = false
          stdout.write("\x1b7\n\x1b[2K\x1b8")
        }
        const disarm = () => {
          if (!armed) {
            return
          }
          armed = false
          hideHint()
        }

        const totalVisualRows = (): number => {
          const w = width()
          let total = 0
          for (let i = 0; i < lines.length; i++) {
            // biome-ignore lint/style/noNonNullAssertion: i < lines.length
            total += visualRows(promptWidth + lines[i]!.length, w)
          }
          return total
        }

        const computeTarget = (): { row: number; col: number } => {
          const w = width()
          let r = 0
          for (let i = 0; i < row; i++) {
            // biome-ignore lint/style/noNonNullAssertion: i < row < lines.length
            r += visualRows(promptWidth + lines[i]!.length, w)
          }
          const inLine = promptWidth + col
          r += Math.floor(inLine / w)
          return { row: r, col: inLine % w }
        }

        const render = () => {
          if (lastTargetRow > 0) {
            stdout.write(`\x1b[${lastTargetRow}A`)
          }
          stdout.write("\r\x1b[0J")

          const w = width()
          // biome-ignore lint/style/noNonNullAssertion: lines is never empty
          const first = lines[0]!
          stdout.write(promptText)
          stdout.write(first)
          let endRow = Math.floor((promptWidth + first.length) / w)
          if (first.length > 0 && (promptWidth + first.length) % w === 0) {
            endRow -= 1 // phantom column at exact width boundary
          }

          for (let i = 1; i < lines.length; i++) {
            // biome-ignore lint/style/noNonNullAssertion: i < lines.length
            const ln = lines[i]!
            stdout.write("\n")
            endRow += 1
            stdout.write(" ".repeat(promptWidth))
            stdout.write(ln)
            const lineLen = promptWidth + ln.length
            endRow += Math.floor(lineLen / w)
            if (ln.length > 0 && lineLen % w === 0) {
              endRow -= 1
            }
          }

          const target = computeTarget()

          // Move from (endRow, current col) to (target.row, target.col)
          const rowsUp = endRow - target.row
          if (rowsUp > 0) {
            stdout.write(`\x1b[${rowsUp}A`)
          } else if (rowsUp < 0) {
            stdout.write(`\x1b[${-rowsUp}B`)
          }
          stdout.write("\r")
          if (target.col > 0) {
            stdout.write(`\x1b[${target.col}C`)
          }

          lastTargetRow = target.row
        }

        const finish = (intent: "submit" | "exit") => {
          active = null
          hideHint()
          // Move cursor to past the last visual row of the input.
          const total = totalVisualRows()
          const downBy = total - 1 - lastTargetRow
          if (downBy > 0) {
            stdout.write(`\x1b[${downBy}B`)
          }
          stdout.write("\r\n")
          const value = intent === "submit" ? lines.join("\n") : ""
          resolve({ value, intent })
        }

        const cur = (): string => {
          // biome-ignore lint/style/noNonNullAssertion: row is always a valid index
          return lines[row]!
        }

        const insertChar = (ch: string) => {
          const c = cur()
          lines[row] = c.slice(0, col) + ch + c.slice(col)
          col += ch.length
        }

        const insertNewline = () => {
          const c = cur()
          lines[row] = c.slice(0, col)
          lines.splice(row + 1, 0, c.slice(col))
          row++
          col = 0
        }

        const backspace = () => {
          const c = cur()
          if (col > 0) {
            lines[row] = c.slice(0, col - 1) + c.slice(col)
            col--
          } else if (row > 0) {
            // biome-ignore lint/style/noNonNullAssertion: row > 0 so row-1 is valid
            const prev = lines[row - 1]!
            const prevLen = prev.length
            lines[row - 1] = prev + c
            lines.splice(row, 1)
            row--
            col = prevLen
          }
        }

        const deleteForward = () => {
          const c = cur()
          if (col < c.length) {
            lines[row] = c.slice(0, col) + c.slice(col + 1)
          } else if (row < lines.length - 1) {
            // biome-ignore lint/style/noNonNullAssertion: row+1 < lines.length
            lines[row] = c + lines[row + 1]!
            lines.splice(row + 1, 1)
          }
        }

        const moveLeft = () => {
          if (col > 0) {
            col--
          } else if (row > 0) {
            row--
            col = cur().length
          }
        }
        const moveRight = () => {
          if (col < cur().length) {
            col++
          } else if (row < lines.length - 1) {
            row++
            col = 0
          }
        }
        const moveUp = () => {
          if (row > 0) {
            row--
            col = Math.min(col, cur().length)
          }
        }
        const moveDown = () => {
          if (row < lines.length - 1) {
            row++
            col = Math.min(col, cur().length)
          }
        }

        active = (data: string) => {
          let i = 0
          let needsRender = false

          while (i < data.length) {
            const remaining = data.slice(i)

            if (remaining.startsWith(PASTE_START)) {
              disarm()
              inPaste = true
              i += PASTE_START.length
              continue
            }
            if (remaining.startsWith(PASTE_END)) {
              inPaste = false
              i += PASTE_END.length
              continue
            }

            // biome-ignore lint/style/noNonNullAssertion: i < data.length
            const ch = data[i]!

            if (inPaste) {
              if (ch === "\r" && data[i + 1] === "\n") {
                insertNewline()
                needsRender = true
                i += 2
                continue
              }
              if (ch === "\r" || ch === "\n") {
                insertNewline()
                needsRender = true
                i++
                continue
              }
              if (ch === "\t") {
                insertChar("  ")
                needsRender = true
                i++
                continue
              }
              if (ch >= " ") {
                insertChar(ch)
                needsRender = true
                i++
                continue
              }
              i++
              continue
            }

            // Outside paste

            if (ch === "\x03") {
              if (armed) {
                finish("exit")
                return
              }
              armed = true
              showHint()
              i++
              continue
            }

            // Any other key disarms a pending Ctrl+C
            disarm()

            if (ch === "\x04") {
              // Ctrl+D: exit only when buffer is empty
              if (lines.length === 1 && cur().length === 0) {
                finish("exit")
                return
              }
              i++
              continue
            }

            if (ch === "\r") {
              finish("submit")
              return
            }
            // Ctrl+J (\n) inserts a newline. Shift+Enter on terminals that
            // can be configured to send \n (or \x1b\r) ends up here too.
            if (ch === "\n") {
              insertNewline()
              needsRender = true
              i++
              continue
            }

            const next = data[i + 1]

            // Shift+Enter: Esc + Enter (iTerm2/Alacritty/Ghostty when configured)
            if (ch === "\x1b" && (next === "\r" || next === "\n")) {
              insertNewline()
              needsRender = true
              i += 2
              continue
            }

            // CSI sequences
            if (ch === "\x1b" && next === "[") {
              // biome-ignore lint/suspicious/noControlCharactersInRegex: matching CSI escape sequences
              const match = remaining.match(/^\x1b\[[\d;]*[A-Za-z~]/)
              if (match) {
                const seq = match[0]
                // Shift+Enter via CSI-u protocol (e.g. \x1b[13;2u)
                if (seq === "\x1b[13;2u") {
                  insertNewline()
                  needsRender = true
                  i += seq.length
                  continue
                }
                if (seq === "\x1b[A") {
                  moveUp()
                } else if (seq === "\x1b[B") {
                  moveDown()
                } else if (seq === "\x1b[C") {
                  moveRight()
                } else if (seq === "\x1b[D") {
                  moveLeft()
                } else if (seq === "\x1b[H") {
                  col = 0
                } else if (seq === "\x1b[F") {
                  col = cur().length
                } else if (seq === "\x1b[3~") {
                  deleteForward()
                }
                needsRender = true
                i += seq.length
                continue
              }
            }

            if (ch === "\x1b") {
              // Standalone escape — ignore
              i++
              continue
            }

            if (ch === "\x7f" || ch === "\b") {
              backspace()
              needsRender = true
              i++
              continue
            }

            if (ch === "\t") {
              insertChar("  ")
              needsRender = true
              i++
              continue
            }

            if (ch >= " ") {
              insertChar(ch)
              needsRender = true
              i++
              continue
            }

            i++
          }

          if (needsRender) {
            render()
          }
        }

        render()
      }),
  }
}
