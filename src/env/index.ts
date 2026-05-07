import { z } from "zod"
import { Environment } from "../lib/environment"

const environment = new Environment(
  z.object({
    AMASS_API_BASE_URL: z.string().default("https://api.amass.tech"),
    AMASS_API_KEY: z.string(),

    MODEL: z.string(),

    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    LITELLM_BASE_URL: z.string().url().optional(),
    LITELLM_API_KEY: z.string().optional(),
    AWS_BEARER_TOKEN_BEDROCK: z.string().optional(),
    AWS_REGION: z.string().optional(),
  }),
)

export default environment.env
