import { createHash } from "node:crypto";
import { HASH_ALGORITHM } from "./constants.js";

/**
 * Hash a value deterministically using canonical JSON serialization.
 * Objects are sorted by key to ensure consistent hashing regardless of property order.
 */
export function hashValue(value: unknown): string {
  const canonical = canonicalize(value);
  return `${HASH_ALGORITHM}:${createHash(HASH_ALGORITHM).update(canonical).digest("hex")}`;
}

/**
 * Constant-time string comparison to prevent timing attacks on hash comparisons.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Canonical JSON: sorted keys, no whitespace, deterministic output.
 * This ensures the same object always produces the same hash.
 */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }

  if (typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          JSON.stringify(key) +
          ":" +
          canonicalize((value as Record<string, unknown>)[key])
      );
    return "{" + sorted.join(",") + "}";
  }

  return String(value);
}
