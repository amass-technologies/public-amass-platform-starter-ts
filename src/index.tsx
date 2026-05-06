import { say } from "cfonts"
import { render } from "ink"
import { App } from "./app"
import { getModel } from "./model"

say("Amass", {
  font: "block",
  align: "left",
  gradient: ["#d97a5e", "#7a3826"],
  transitionGradient: true,
  space: false,
})
console.log("\x1b[1mResearch Assistant\x1b[0m\n")
console.log("Welcome — I help you explore the biomedical literature and clinical trials.")
console.log("Ask about a topic, drug, disease, gene, paper, or specific clinical study, and")
console.log("I'll search the Amass BiomedCore (PubMed) and TrialCore (ClinicalTrials.gov)")
console.log("for relevant records.\n")
console.log("Type /exit, press Ctrl+D, or press Ctrl+C twice to quit.\n")

const modelSpec = process.env.MODEL
if (!modelSpec) {
  throw new Error('MODEL must be set (e.g. "anthropic:claude-opus-4-7"). See .env.example.')
}

render(<App model={getModel(modelSpec)} />, { exitOnCtrlC: false })
