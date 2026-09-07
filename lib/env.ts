/**
 * Environment Variable Validation & Diagnostics for O.D.I.N. (Phase 2)
 *
 * Rules:
 * - Server-only secrets (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_ENCRYPTION_KEY)
 *   must NEVER be exposed to the client bundle or returned in public API payloads.
 * - Client-accessible keys must be explicitly prefixed with NEXT_PUBLIC_.
 */

export interface SystemEnvDiagnostics {
  gemini: {
    configured: boolean;
    model: string;
  };
  supabase: {
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    serviceRoleConfigured: boolean;
  };
  encryption: {
    configured: boolean;
    isValidLength: boolean;
  };
  security: {
    passcodeProtected: boolean;
  };
  nodeEnv: string;
  timestamp: string;
}

/**
 * Validates whether the application-layer encryption key is a valid 32-byte hex string (64 chars).
 */
export function isValidEncryptionKey(key?: string): boolean {
  if (!key) return false;
  return /^[0-9a-fA-F]{64}$/.test(key.trim());
}

/**
 * Verifies whether an incoming candidate access passcode matches the server-configured passkey.
 * If ODIN_ACCESS_PASSCODE is not set on the server, it allows access (opt-in protection).
 */
export function verifyPasscode(candidate?: string | null): boolean {
  const configuredPasscode = process.env.ODIN_ACCESS_PASSCODE?.trim();
  if (!configuredPasscode) {
    return true; // No passcode gate set on server
  }
  if (!candidate) {
    return false;
  }
  return candidate.trim() === configuredPasscode;
}

/**
 * Returns safe, non-sensitive boolean diagnostics of the system's environment configuration.
 * Safe to expose to authenticated/diagnostic dashboard routes.
 */
export function getEnvDiagnostics(): SystemEnvDiagnostics {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const rawModel = process.env.GEMINI_MODEL?.trim();
  const geminiModel =
    !rawModel || rawModel.includes("gemini-2.5") || rawModel.includes("gemini-1.5")
      ? "gemini-3.6-flash"
      : rawModel;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const encryptionKey = process.env.APP_ENCRYPTION_KEY?.trim();
  const passcode = process.env.ODIN_ACCESS_PASSCODE?.trim();

  return {
    gemini: {
      configured: Boolean(geminiKey && geminiKey !== "your-google-gemini-api-key-here" && !geminiKey.includes("your-gemini-api-key-here")),
      model: geminiModel,
    },
    supabase: {
      urlConfigured: Boolean(supabaseUrl && !supabaseUrl.includes("your-project-id")),
      anonKeyConfigured: Boolean(supabaseAnon && !supabaseAnon.includes("your-supabase-anon-key")),
      serviceRoleConfigured: Boolean(supabaseService && !supabaseService.includes("your-supabase-service-role-key")),
    },
    encryption: {
      configured: Boolean(encryptionKey && !encryptionKey.includes("your-64-character")),
      isValidLength: isValidEncryptionKey(encryptionKey),
    },
    security: {
      passcodeProtected: Boolean(passcode && !passcode.includes("your-secure-access-passcode")),
    },
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Server-only helper to get Gemini API credentials with fail-fast assertions.
 */
export function getServerGeminiConfig() {
  if (typeof window !== "undefined") {
    throw new Error("Security Violation: Attempted to access server secrets in browser context.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  const rawModel = process.env.GEMINI_MODEL?.trim();
  const model =
    !rawModel || rawModel.includes("gemini-2.5") || rawModel.includes("gemini-1.5")
      ? "gemini-3.6-flash"
      : rawModel;

  return {
    apiKey,
    model,
  };
}
