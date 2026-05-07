import { z } from "zod"

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Staging = "staging",
  Test = "test",
}

export class Environment<T extends z.ZodObject<z.ZodRawShape>> {
  private schema: T
  private _env: z.infer<typeof this.schema> | undefined

  constructor(schema: T) {
    this.schema = schema
  }

  get env(): z.infer<T> {
    if (this._env) {
      return this._env
    }

    if (process.env.SKIP_ENV_VALIDATION === "true") {
      console.debug("Skipping env validation")
      this._env = {} as z.infer<typeof this.schema>
      return this._env
    }

    const parsed = this.schema.safeParse(process.env)

    if (!parsed.success) {
      const errorMessage = z.prettifyError(parsed.error)
      console.error(`Missing or invalid environment variables\n--------\n${errorMessage}\n--------\n`)
      throw new Error(errorMessage)
    }

    this._env = parsed.data
    return this._env as z.infer<T>
  }
}
