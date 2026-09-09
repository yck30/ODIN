import fs from "fs";
import path from "path";
import { executeSequentialAnalysis } from "../lib/engine/orchestrator";
import type { DecisionIntake } from "../lib/engine/types";

// Load .env.local manually for test script execution
function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
      process.env[key] = value;
    }
  }
  return env;
}

async function runTest() {
  console.log("=== O.D.I.N. Phase 2 Milestone 2 Engine Verification ===");
  loadEnvLocal();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("FATAL: GEMINI_API_KEY is not configured in .env.local");
    process.exit(1);
  }

  const sampleDilemma: DecisionIntake = {
    core_objectives: "Determine whether to pivot company go-to-market from enterprise high-touch sales to self-serve Product-Led Growth (PLG).",
    known_constraints: "6 months of runway remaining ($300k cash). Team: 4 engineers, 1 sales lead. Enterprise sales cycle average 5 months.",
    raw_narrative: "We currently have 2 enterprise pilot contracts ($60k ARR each) in verbal agreement, but one prospect's procurement team has been unresponsive for 14 days. Meanwhile, our organic self-serve product is getting 120 signups/week with no paid acquisition, but free-to-paid conversion on the $39/mo tier is only 1.1%. The engineering team is pushing to scrap enterprise and focus 100% on PLG, while our lead investor insists on high-ACV enterprise accounts. We cannot afford to miss payroll in month 7.",
  };

  console.log("\n[1/3] Triggering 4-Persona Sequential Analysis...");
  const startTime = Date.now();

  const result = await executeSequentialAnalysis(
    sampleDilemma,
    apiKey,
    (step, total, message) => {
      console.log(`  -> [Stage ${step}/${total}] ${message}`);
    }
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[2/3] All 4 Personas completed in ${durationSec}s.`);

  // Validation Checks
  console.log("\n[3/3] Validating Section 20 Schema Conformance...");

  // Quant Validation
  if (result.quant.persona !== "quant" || !Array.isArray(result.quant.paths) || result.quant.paths.length < 2) {
    throw new Error("Quant output failed schema validation: paths array invalid or < 2.");
  }
  console.log("  ✓ The Quant: Schema valid. Identified paths:", result.quant.paths.map((p) => p.name).join(", "));

  // Strategist Validation
  if (result.strategist.persona !== "strategist" || !["adversarial", "non_adversarial"].includes(result.strategist.domain_framing)) {
    throw new Error("Strategist output failed schema validation: invalid domain framing.");
  }
  console.log(`  ✓ The Strategist: Schema valid. Domain: ${result.strategist.domain_framing}, Reversibility moves: ${result.strategist.reversibility_ranking.length}`);

  // Behaviorist Validation
  if (result.behaviorist.persona !== "behaviorist" || !Array.isArray(result.behaviorist.biases_detected) || result.behaviorist.biases_detected.length < 3) {
    throw new Error("Behaviorist output failed schema validation: expected at least 3 baseline biases.");
  }
  console.log("  ✓ The Behaviorist: Schema valid. Biases audited:", result.behaviorist.biases_detected.map((b) => `${b.bias} (${b.present})`).join(", "));

  // Judge Validation
  if (!result.judge.synthesis || !Array.isArray(result.judge.next_3_actions) || result.judge.next_3_actions.length !== 3) {
    throw new Error(`Judge output failed schema validation: next_3_actions count = ${result.judge.next_3_actions?.length} (must be exactly 3).`);
  }
  if (!result.judge.mermaid_diagram || (!result.judge.mermaid_diagram.includes("graph") && !result.judge.mermaid_diagram.includes("flowchart"))) {
    throw new Error("Judge output failed schema validation: invalid Mermaid.js flowchart syntax.");
  }
  if (result.judge.pattern_note === undefined) {
    throw new Error("Judge output failed schema validation: pattern_note field is missing (must be string or null per FR-24).");
  }
  console.log(`  ✓ The Judge: Synthesis valid. Exactly 3 actions sequenced. Mermaid diagram & pattern_note (${result.judge.pattern_note === null ? "null" : `"${result.judge.pattern_note}"`}) generated.`);

  console.log("\n========================================================");
  console.log("DECISION VERDICT:");
  console.log(`"${result.judge.recommended_path}"`);
  console.log("\nSEQUENCED NEXT 3 ACTIONS:");
  result.judge.next_3_actions.forEach((act, idx) => console.log(`  ${idx + 1}. ${act}`));
  console.log("\nMERMAID DIAGRAM PREVIEW:");
  console.log(result.judge.mermaid_diagram);
  console.log("========================================================");
  console.log("M2 COGNITIVE REASONING ENGINE VERIFIED SUCCESSFULLY!");
}

runTest().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
