export const VERSION = "0.1.0";
export const LOCKFILE_VERSION = 1;
export const DEFAULT_LOCKFILE = "mcp-lock.json";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const HASH_ALGORITHM = "sha256";

// Exit codes following Unix conventions
export const EXIT_OK = 0; // Clean — lockfile matches, no findings
export const EXIT_DRIFT = 1; // Drift detected or scan findings above threshold
export const EXIT_ERROR = 2; // Runtime error (missing file, connection failure)
