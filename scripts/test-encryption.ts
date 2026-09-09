import fs from "fs";
import path from "path";
import { encryptNarrative, encryptNarrativeToHex, decryptNarrative } from "../lib/crypto";

// Load .env.local manually for standalone scripts
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
  console.log("=== O.D.I.N. Milestone 3 (M3) Encryption Verification ===");
  loadEnvLocal();

  const testNarrative =
    "Confidential stakeholder dispute: VP of Engineering refuses to migrate cloud provider. $450k early-termination penalty applies if broken before Q4.";

  console.log("\n[1/4] Testing Buffer Round-Trip (AES-256-GCM)...");
  const encryptedBuf = encryptNarrative(testNarrative);
  console.log(`  ✓ Encrypted buffer length: ${encryptedBuf.length} bytes`);
  console.log(`  ✓ Ciphertext sample (hex): ${encryptedBuf.toString("hex").slice(0, 32)}...`);

  const decryptedText = decryptNarrative(encryptedBuf);
  if (decryptedText !== testNarrative) {
    throw new Error("Decryption mismatch: recovered text does not equal original plaintext.");
  }
  console.log("  ✓ Decrypted text matches original plaintext perfectly.");

  console.log("\n[2/4] Testing Postgres Hex Representation (\\x...)...");
  const hexCiphertext = encryptNarrativeToHex(testNarrative);
  if (!hexCiphertext.startsWith("\\x")) {
    throw new Error("Postgres hex string must start with \\x prefix.");
  }
  const decryptedFromHex = decryptNarrative(hexCiphertext);
  if (decryptedFromHex !== testNarrative) {
    throw new Error("Decryption from hex format failed.");
  }
  console.log("  ✓ Postgres hex string encrypted and decrypted successfully.");

  console.log("\n[3/4] Testing Tamper / Authentication Tag Enforcement...");
  // Mutate one byte in ciphertext
  const tamperedBuf = Buffer.from(encryptedBuf);
  tamperedBuf[tamperedBuf.length - 1] ^= 0xff; // flip last byte

  let tamperCaught = false;
  try {
    decryptNarrative(tamperedBuf);
  } catch (err: unknown) {
    tamperCaught = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✓ Tampering successfully rejected by AES-GCM tag verification: "${msg}"`);
  }

  if (!tamperCaught) {
    throw new Error("Security Failure: Tampered ciphertext was accepted without authentication tag failure!");
  }

  console.log("\n[4/4] Testing Unicode, Emoji, and Multi-Line Payloads...");
  const complexNarrative = "🚨 Critical 3rd-party vendor breach: Alice (CTO) said 'We cannot disclose this yet!'. 繁體中文 & 特殊符號 tested.";
  const complexEncrypted = encryptNarrative(complexNarrative);
  const complexDecrypted = decryptNarrative(complexEncrypted);
  if (complexDecrypted !== complexNarrative) {
    throw new Error("Complex unicode decryption failed.");
  }
  console.log("  ✓ Unicode and special symbols verified cleanly.");

  console.log("\n========================================================");
  console.log("ALL APP-LAYER ENCRYPTION INTEGRITY TESTS PASSED (FR-17)!");
  console.log("========================================================");
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
