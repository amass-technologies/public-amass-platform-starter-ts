import { getModel } from "./src/model"
import { runRepl } from "./src/repl"

const modelSpec = process.env.MODEL ?? "anthropic:claude-opus-4-7"
await runRepl({ model: getModel(modelSpec) })
