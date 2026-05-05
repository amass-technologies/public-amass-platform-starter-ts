import { say } from "cfonts"
import { getModel } from "./src/model"
import { runRepl } from "./src/repl"

say("Amass", {
  font: "block",
  align: "left",
  colors: ["cyan", "blue"],
  space: false,
})
console.log("\x1b[1mResearch Assistant\x1b[0m\n")
console.log("Welcome — I help you explore the biomedical literature.")
console.log("Ask about a topic, drug, disease, gene, or specific paper, and I'll search")
console.log("the Amass BiomedCore (PubMed-derived) for relevant publications.\n")

const modelSpec = process.env.MODEL ?? "anthropic:claude-opus-4-7"
await runRepl({ model: getModel(modelSpec) })
