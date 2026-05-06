import type { ToolResultFormatter } from "./tools"

const MAX_STR_LEN = 120
const MAX_ARRAY_ITEMS = 3
const MAX_DEPTH = 8

function shrink(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "…"
  }
  if (typeof value === "string") {
    return value.length > MAX_STR_LEN ? `${value.slice(0, MAX_STR_LEN)}…` : value
  }
  if (Array.isArray(value)) {
    const head: unknown[] = value.slice(0, MAX_ARRAY_ITEMS).map((v) => shrink(v, depth + 1))
    if (value.length > MAX_ARRAY_ITEMS) {
      head.push(`… +${value.length - MAX_ARRAY_ITEMS} more`)
    }
    return head
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = shrink(v, depth + 1)
    }
    return out
  }
  return value
}

export function truncatedJSON(value: unknown): string {
  return JSON.stringify(shrink(value), null, 2)
}

export function formatToolResult(
  name: string,
  result: unknown,
  formatters: Record<string, ToolResultFormatter>,
): string {
  const formatter = formatters[name]
  if (formatter) {
    return formatter(result)
  }
  if (typeof result === "string") {
    return result
  }
  return truncatedJSON(result)
}

export function indentContinuation(s: string, indent: string): string {
  return s.split("\n").join(`\n${indent}`)
}

export const CONTINUATION_INDENT = "    "
