import fs from "fs";
import path from "path";
import { getServerSupabaseClient, getAnonSupabaseClient } from "../lib/supabase/server";
import { encryptNarrativeToHex, decryptNarrative } from "../lib/crypto";

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
  console.log("=== O.D.I.N. Milestone N1 session_outcomes Verification ===");
  loadEnvLocal();

  const anonClient = getAnonSupabaseClient();
  const serverClient = getServerSupabaseClient();

  // 1. Verify RLS Denial on Anonymous Client
  console.log("\n[1/5] Testing Row-Level Security (RLS) Denial with Anon Client (FR-26)...");
  const { data: anonData, error: anonError } = await anonClient
    .from("session_outcomes")
    .select("id")
    .limit(1);

  if (!anonError && anonData && anonData.length > 0) {
    throw new Error(
      "Security Violation: Anonymous client was able to read session_outcomes table! RLS policy not enforcing denial."
    );
  }
  console.log("  ✓ Anonymous client correctly denied access by RLS policies.");

  let sessionId: string | null = null;

  try {
    // 2. Create Temporary Test Parent Session
    console.log("\n[2/5] Creating Temporary Parent Session in Supabase...");
    const dummyEmbedding = Array(768).fill(0.01);
    const testNarrative = "TEST PARENT SESSION: Validating session_outcomes integration.";
    const encryptedParentNarrative = encryptNarrativeToHex(testNarrative);

    const { data: parentSession, error: parentError } = await serverClient
      .from("sessions")
      .insert({
        core_objectives: "Verify session_outcomes schema and cascading lifecycle.",
        known_constraints: "Zero-cost tier, RLS enabled.",
        raw_narrative_encrypted: encryptedParentNarrative,
        quant_output: { test: true },
        strategist_output: { test: true },
        behaviorist_output: { test: true },
        judge_output: { synthesis: "Initial test synthesis for outcome validation." },
        narrative_embedding: dummyEmbedding,
        embedding_model: "gemini-embedding-001",
      })
      .select("id")
      .single();

    if (parentError || !parentSession) {
      throw new Error(`Failed to insert test parent session: ${parentError?.message}`);
    }
    sessionId = parentSession.id;
    console.log(`  ✓ Parent session created. ID: ${sessionId}`);

    // 3. Test Inserting Encrypted Outcome
    console.log("\n[3/5] Inserting Encrypted Outcome via Server Client (FR-26 & FR-28)...");
    const secretReflection = "CONFIDENTIAL: Executed recommendation to pivot. Retained 92% of users with positive ROI.";
    const encryptedReflectionHex = encryptNarrativeToHex(secretReflection);

    const { data: outcomeRow, error: outcomeError } = await serverClient
      .from("session_outcomes")
      .insert({
        session_id: sessionId,
        status: "followed_path",
        narrative_encrypted: encryptedReflectionHex,
        prompted_via: "opportunistic",
      })
      .select("id, session_id, status, narrative_encrypted, prompted_via, recorded_at")
      .single();

    if (outcomeError || !outcomeRow) {
      throw new Error(`Failed to insert outcome row: ${outcomeError?.message}`);
    }

    console.log(`  ✓ Outcome inserted successfully. ID: ${outcomeRow.id}`);
    console.log(`  ✓ Status: ${outcomeRow.status}`);
    console.log(`  ✓ Stored ciphertext field: ${outcomeRow.narrative_encrypted.substring(0, 32)}...`);

    // 4. Test Decrypting Outcome Narrative
    console.log("\n[4/5] Retrieving & Decrypting Outcome Narrative...");
    const decrypted = decryptNarrative(outcomeRow.narrative_encrypted);
    console.log(`  ✓ Decrypted text matches original secret reflection: "${decrypted.substring(0, 40)}..."`);
    if (decrypted !== secretReflection) {
      throw new Error("Decryption mismatch: Decrypted text does not match original secret reflection.");
    }

    // Test unique constraint enforcement (FR-26)
    console.log("  Testing unique constraint on session_id (duplicate outcome rejection)...");
    const { error: duplicateError } = await serverClient
      .from("session_outcomes")
      .insert({
        session_id: sessionId,
        status: "deviated",
        prompted_via: "manual",
      });

    if (!duplicateError) {
      throw new Error("Integrity Failure: Duplicate outcome was accepted! UNIQUE constraint missing on session_id.");
    }
    console.log("  ✓ Duplicate outcome correctly rejected by UNIQUE constraint.");

    // 5. Test Cascading Deletion (ON DELETE CASCADE)
    console.log("\n[5/5] Testing Cascading Deletion when Parent Session is Deleted...");
    const { error: deleteParentError } = await serverClient
      .from("sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteParentError) {
      throw new Error(`Failed to delete parent session: ${deleteParentError.message}`);
    }

    // Verify session_outcomes row is automatically deleted
    const { data: orphanedOutcome, error: checkError } = await serverClient
      .from("session_outcomes")
      .select("id")
      .eq("session_id", sessionId);

    if (checkError) {
      throw new Error(`Error verifying cascade: ${checkError.message}`);
    }
    if (orphanedOutcome && orphanedOutcome.length > 0) {
      throw new Error("Cascading Deletion Failure: session_outcomes row was not purged when parent session was deleted!");
    }
    console.log("  ✓ Cascading deletion verified: outcome row purged cleanly with parent session.");
    sessionId = null; // Cleaned up

    console.log("\n========================================================");
    console.log("ALL MILESTONE N1 SESSION_OUTCOMES TESTS PASSED!");
    console.log("========================================================\n");
  } finally {
    if (sessionId) {
      await serverClient.from("sessions").delete().eq("id", sessionId);
    }
    // Also clean up any lingering test session from earlier attempt
    await serverClient.from("sessions").delete().eq("id", "24c84dc4-e873-45c3-b67a-333d1a11ac23");
  }
}

runTest().catch((err) => {
  console.error("\nTest Execution Failed:", err);
  process.exit(1);
});
