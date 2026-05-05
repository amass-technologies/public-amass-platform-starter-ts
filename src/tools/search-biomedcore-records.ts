import { tool } from "ai"
import { z } from "zod"

export const searchBiomedcoreRecords = tool({
  description: "Search for records in the Biomedcore database.",
  inputSchema: z.object({
    query: z.string().describe("The query to search for."),
  }),
  execute: async ({ query }) => {
    const response = await fetch(`https://api.biomedcore.com/search?query=${query}`)
    return response.json()
  },
})
