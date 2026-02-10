/**
 * mcp-lock.json schema — the lockfile format.
 *
 * Design principles:
 * - Hash-only storage for descriptions/schemas (privacy — originals never stored)
 * - Canonical JSON for deterministic hashing
 * - Environment variable names only (never values)
 * - Paths sanitized (home dir → ~)
 */

export interface Lockfile {
  /** Schema version — bump on breaking changes */
  version: number;
  /** ISO 8601 timestamp of when lockfile was generated */
  locked: string;
  /** Hostname where lockfile was generated */
  host: string;
  /** MCP client that was scanned (e.g., "claude-desktop", "cursor", "claude-code-cli") */
  client: string;
  /** Config file path that was scanned */
  configPath: string;
  /** Pinned server definitions */
  servers: Record<string, LockfileServer>;
}

export interface LockfileServer {
  /** Transport type: "stdio" | "sse" | "streamable-http" */
  transport: string;
  /** Command (stdio) or URL (HTTP) — with env vars as names, not values */
  command?: string;
  /** Command arguments (with env var names, not values) */
  args?: string[];
  /** URL for HTTP-based transports */
  url?: string;
  /** Environment variable names used (never values) */
  envVars?: string[];
  /** Protocol version reported by server (from initialize response) */
  protocolVersion?: string;
  /** Server name reported by server */
  serverName?: string;
  /** Server version reported by server */
  serverVersion?: string;
  /** Pinned tools */
  tools: Record<string, LockfileTool>;
  /** Number of tools at pin time */
  toolCount: number;
}

export interface LockfileTool {
  /** SHA-256 hash of the tool description (canonical JSON) */
  descriptionHash: string;
  /** SHA-256 hash of the input schema (canonical JSON) */
  inputSchemaHash: string;
  /** Inferred capabilities from description analysis */
  capabilities: string[];
}

/**
 * Live tool data fetched from an MCP server via tools/list.
 */
export interface LiveTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Live server metadata from initialize response.
 */
export interface LiveServerInfo {
  protocolVersion?: string;
  serverName?: string;
  serverVersion?: string;
  tools: LiveTool[];
}
