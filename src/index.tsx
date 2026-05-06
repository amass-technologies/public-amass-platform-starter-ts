import { render } from "ink"
import { App } from "./app"
import { printIntro } from "./intro"
import { getModel } from "./model"

printIntro()

const modelSpec = process.env.MODEL
if (!modelSpec) {
  throw new Error('MODEL must be set (e.g. "anthropic:claude-opus-4-7"). See .env.example.')
}

render(<App model={getModel(modelSpec)} />, { exitOnCtrlC: false })
