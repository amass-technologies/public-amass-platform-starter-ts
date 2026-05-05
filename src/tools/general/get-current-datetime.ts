import { tool } from "ai"
import { z } from "zod"

export const getCurrentDatetime = tool({
  description: "Returns the current date and time as an ISO 8601 string in UTC.",
  inputSchema: z.object({}),
  execute: async () => new Date().toISOString(),
})
