/**
 * Types for MCP configuration files across different clients.
 */

export interface MCPConfig {
  /** Which client this config belongs to */
  client: string;
  /** Absolute path to the config file */
  configPath: string;
  /** Server definitions from the config */
  servers: Record<string, MCPServerConfig>;
}

export interface MCPServerConfig {
  /** Transport type */
  transport?: "stdio" | "sse" | "streamable-http";
  /** Command for stdio transport */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** URL for HTTP-based transports */
  url?: string;
  /** Environment variables (name → value) */
  env?: Record<string, string>;
}

export interface ConfigLocation {
  client: string;
  path: string;
  exists: boolean;
}
