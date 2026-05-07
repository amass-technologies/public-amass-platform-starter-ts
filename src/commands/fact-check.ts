import type { Command } from "./types"

const PROMPT_PREFIX = `You are fact-checking the user's text. Follow this exact workflow:

1. CLAIM EXTRACTION
   Identify each distinct, verifiable factual claim in the text. A claim is a statement that could be confirmed or refuted with evidence (e.g., "Drug X reduces mortality by 20%", "Trial Y enrolled 500 patients"). Skip subjective opinions, vague generalities, and rhetorical framing.

   If the text contains more than 10 verifiable claims, narrow to the 10 boldest — strong, specific assertions most likely to mislead a reader if wrong (numerical effects, causal claims, attributions to specific trials, counterintuitive findings). Drop safe generalities (e.g., "diabetes is common"). Briefly note that you narrowed the list and how many claims you skipped.

   If the text contains no verifiable claims, say so and stop.

2. PARALLEL DELEGATION
   For each claim, call the delegate_to_subagent tool. Issue all delegations in parallel (a single tool-call batch) — they are independent. Each subagent's instructions should:
   - State exactly one claim, quoted verbatim from the user's text where possible.
   - Tell it which tools fit: BiomedCore for mechanism, treatment effects, epidemiology, and general literature; TrialCore for specific trial outcomes, recruitment status, sponsors, endpoints. Many claims need both.
   - Request a structured response with:
     a. Verdict ("well-supported" / "mixed evidence" / "unsupported").
     b. 1-2 sentences of evidence reasoning grounded in the records found.
     c. Specific citations (PMIDs and/or NCT IDs).
     d. Critical evaluation of evidence quality — be skeptical, not just confirmatory:
        - For trials: sample size (small studies are less reliable), participant demographics and inclusion criteria (was the population narrow — single sex, single ethnicity, single age band, excluding common comorbidities — and is the result generalizable?), phase, randomization and blinding, sponsor (industry-funded vs independent academic).
        - For papers: study type (RCT > prospective cohort > retrospective > case series > opinion), journal quality, citation count (well-cited indicates community uptake; very low cites in an established field is a warning), retraction status, and conflicts of interest.
        - Note when evidence is thin (a single small study, or all from one research group) versus robust (multiple independent replications across populations).

3. SYNTHESIS
   Once all subagents have responded, present a numbered list. For each claim:

   **Claim N:** <claim text, quoted>
   **Verdict:** well-supported / mixed evidence / unsupported
   **Evidence:** <brief explanation drawn from the subagent's reply>
   **Quality of evidence:** <critical evaluation — sample size, demographics, study type, journal/citation reputation, retraction status, replication, conflicts of interest. Highlight specific weaknesses.>
   **Citations:** <PMIDs and/or NCT IDs>

   End with a one-line overall summary of how the body of text holds up — and flag the single biggest evidence-quality concern across the claims (e.g. "most claims rest on a single small industry-funded trial").

User's text:

`

export const factCheckCommand: Command = {
  name: "fact-check",
  description: "Extract claims from text, fact-check each via subagents, return verdicts with citations",
  handler: (_ctx, args) => {
    const text = args.trim()
    if (!text) {
      return { kind: "error", message: "Usage: /fact-check <text>" }
    }
    return { kind: "submit", modelMessage: PROMPT_PREFIX + text }
  },
}
