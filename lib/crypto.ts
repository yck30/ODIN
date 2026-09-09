import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const TAG_LENGTH = 16; // 128-bit authentication tag
const VERSION_BYTE = 0x01; // Version header for future-proof format migration

/**
 * Retrieves and validates the 32-byte (64 hex character) application encryption key.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!keyHex) {
    throw new Error("Application security violation: APP_ENCRYPTION_KEY is not defined in environment.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "Application security violation: APP_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)."
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a sensitive string (e.g. raw_narrative) using AES-256-GCM.
 * Binary format: [1 byte version] + [12 bytes IV] + [16 bytes AuthTag] + [Ciphertext]
 * 
 * Returns a Buffer, which can be passed directly to Supabase bytea columns or serialized as hex.
 */
export function encryptNarrative(plaintext: string): Buffer {
  if (typeof plaintext !== "string") {
    throw new Error("Invalid input: plaintext must be a string.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack into single binary Buffer: [version (1B)][iv (12B)][authTag (16B)][ciphertext (NB)]
  const versionBuf = Buffer.from([VERSION_BYTE]);
  return Buffer.concat([versionBuf, iv, authTag, ciphertext]);
}

/**
 * Encrypts a narrative and returns a Postgres-compatible hex string (\x...).
 * Ideal for raw SQL queries or Supabase client compatibility.
 */
export function encryptNarrativeToHex(plaintext: string): string {
  const buf = encryptNarrative(plaintext);
  return `\\x${buf.toString("hex")}`;
}

/**
 * Decrypts a previously encrypted narrative Buffer or hex-formatted string.
 * Validates integrity via the AES-256-GCM authentication tag.
 */
export function decryptNarrative(encryptedData: Buffer | string): string {
  let buf: Buffer;

  if (typeof encryptedData === "string") {
    const cleanHex = encryptedData.startsWith("\\x") ? encryptedData.slice(2) : encryptedData;
    buf = Buffer.from(cleanHex, "hex");
  } else if (Buffer.isBuffer(encryptedData)) {
    buf = encryptedData;
  } else {
    throw new Error("Invalid input: encryptedData must be a Buffer or hex string.");
  }

  const minLength = 1 + IV_LENGTH + TAG_LENGTH;
  if (buf.length < minLength) {
    throw new Error("Corrupt ciphertext payload: buffer length is below minimum header size.");
  }

  const version = buf[0];
  if (version !== VERSION_BYTE) {
    throw new Error(`Unsupported encryption version: ${version}. Expected ${VERSION_BYTE}.`);
  }

  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const authTag = buf.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(1 + IV_LENGTH + TAG_LENGTH);

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
