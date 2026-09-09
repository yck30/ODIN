import fs from "fs";
import path from "path";
import { getServerSupabaseClient, getAnonSupabaseClient } from "../lib/supabase/server";
import { encryptNarrativeToHex, decryptNarrative } from "../lib/crypto";
import { generateEmbedding, DEFAULT_EMBEDDING_MODEL } from "../lib/embeddings";

// Load .env.local manually for test script execution
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
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
      process.env[key] = value;
    }
  }
}

async function runTest() {
  console.log("=== O.D.I.N. Milestone 3 (M3) Supabase & Persistence Verification ===");
  loadEnvLocal();

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }

  // 1. Verify Vector Embedding Generation
  console.log("\n[1/5] Generating Vector Embedding via Gemini (768-dim)...");
  const sampleSynthesis =
    "Synthesizing Quant, Strategist, and Behaviorist outputs: prioritize preserving 6-month cash runway before scaling enterprise sales.";
  const { embedding, model } = await generateEmbedding(sampleSynthesis, geminiKey);
  console.log(`  ✓ Generated vector with model: ${model}`);
  console.log(`  ✓ Vector dimension: ${embedding.length} (Expected: 768)`);
  if (embedding.length !== 768) {
    throw new Error(`Invalid embedding dimension: got ${embedding.length}, expected 768.`);
  }

  // 2. Test RLS Enforcement on Anonymous Client (FR-16)
  console.log("\n[2/5] Testing Row-Level Security (RLS) Denial with Anon Client (FR-16)...");
  const anonClient = getAnonSupabaseClient();
  const { data: anonData, error: anonError } = await anonClient.from("sessions").select("id").limit(1);
  if (!anonError && anonData && anonData.length > 0) {
    throw new Error("Security Failure (FR-16): Anonymous client was able to read sessions table! RLS is not properly enforcing denial.");
  }
  console.log("  ✓ Anonymous client correctly denied access by RLS policies.");

  // 3. Test Server-Side Persistence with App-Layer Encryption (FR-15 & FR-17)
  console.log("\n[3/5] Inserting Encrypted Session via Server Client (FR-15 & FR-17)...");
  const serverClient = getServerSupabaseClient();

  const secretNarrative = "CONFIDENTIAL: Internal dilemma concerning acquisition offer from direct competitor.";
  const encryptedHex = encryptNarrativeToHex(secretNarrative);

  const testPayload = {
    core_objectives: "Verify database persistence and encryption round-trip.",
    known_constraints: "Automated test runner execution.",
    raw_narrative_encrypted: encryptedHex,
    quant_output: { persona: "quant", summary: "Test quant output" },
    strategist_output: { persona: "strategist", summary: "Test strategist output" },
    behaviorist_output: { persona: "behaviorist", summary: "Test behaviorist output" },
    judge_output: { persona: "judge", synthesis: sampleSynthesis, recommended_path: "Verify persistence" },
    narrative_embedding: embedding,
    embedding_model: DEFAULT_EMBEDDING_MODEL,
  };

  const { data: insertedSession, error: insertError } = await serverClient
    .from("sessions")
    .insert(testPayload)
    .select("id, created_at, raw_narrative_encrypted")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert session into Supabase: ${insertError.message}. Have you run the migration script in Supabase?`);
  }

  const sessionId = insertedSession.id;
  console.log(`  ✓ Session inserted successfully. ID: ${sessionId}`);
  console.log(`  ✓ Stored ciphertext field is not plaintext: ${String(insertedSession.raw_narrative_encrypted).slice(0, 30)}...`);

  // 4. Test Retrieval and Decryption
  console.log("\n[4/5] Retrieving & Decrypting Session from Supabase...");
  const { data: retrievedSession, error: fetchError } = await serverClient
    .from("sessions")
    .select("id, core_objectives, raw_narrative_encrypted, judge_output")
    .eq("id", sessionId)
    .single();

  if (fetchError || !retrievedSession) {
    throw new Error(`Failed to retrieve session ${sessionId}: ${fetchError?.message}`);
  }

  const decryptedNarrative = decryptNarrative(retrievedSession.raw_narrative_encrypted);
  if (decryptedNarrative !== secretNarrative) {
    throw new Error("Decryption verification failed: recovered text does not match secret narrative.");
  }
  console.log("  ✓ Decrypted narrative matches secret narrative perfectly.");

  // 5. Test Hard Deletion (FR-21)
  console.log("\n[5/5] Testing Hard Deletion of Session (FR-21)...");
  const { error: deleteError } = await serverClient
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (deleteError) {
    throw new Error(`Failed to delete session ${sessionId}: ${deleteError.message}`);
  }

  const { data: afterDelete } = await serverClient
    .from("sessions")
    .select("id")
    .eq("id", sessionId);

  if (afterDelete && afterDelete.length > 0) {
    throw new Error(`Security Failure (FR-21): Session ${sessionId} still exists after deletion!`);
  }
  console.log(`  ✓ Hard deletion confirmed: Session ${sessionId} completely purged from Supabase.`);

  console.log("\n========================================================");
  console.log("ALL M3 SUPABASE PERSISTENCE & RLS TESTS PASSED!");
  console.log("========================================================");
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
