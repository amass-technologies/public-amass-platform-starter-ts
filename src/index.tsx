/**
 * Amass Platform Starter (TypeScript)
 * Copyright 2026 Amass Technologies ApS
 * Licensed under the Apache License, Version 2.0 — see LICENSE file.
 */

import { render } from "ink"
import { App } from "./app"
import env from "./env"
import { printIntro } from "./intro"
import { getModel } from "./model"

printIntro()

const modelSpec = env.MODEL
if (!modelSpec) {
  throw new Error('MODEL must be set (e.g. "anthropic:claude-opus-4-7"). See .env.example.')
}

render(<App model={getModel(modelSpec)} />, { exitOnCtrlC: false })
