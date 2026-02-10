import { hostname } from "node:os";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import type { Lockfile, LockfileServer, LockfileTool, LiveServerInfo } from "./types.js";
import type { MCPConfig, MCPServerConfig } from "../parsers/types.js";
import { hashValue } from "../utils/hash.js";
import { LOCKFILE_VERSION } from "../utils/constants.js";
import { connectAndListTools } from "./connector.js";
import { inferCapabilities } from "./capabilities.js";

/**
 * Generate a lockfile by connecting to all servers in the config
 * and pinning their current state.
 */
export async function generateLockfile(
  config: MCPConfig,
  options: { timeoutMs: number; connect: boolean }
): Promise<{ lockfile: Lockfile; errors: Array<{ server: string; error: string }> }> {
  const servers: Record<string, LockfileServer> = {};
  const errors: Array<{ server: string; error: string }> = [];

  for (const [name, serverConfig] of Object.entries(config.servers)) {
    try {
      if (options.connect) {
        const info = await connectAndListTools(name, serverConfig, options.timeoutMs);
        servers[name] = buildServerEntry(serverConfig, info);
      } else {
        // Config-only mode — no live connection, just pin the config shape
        servers[name] = buildConfigOnlyEntry(serverConfig);
      }
    } catch (err) {
      errors.push({
        server: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const lockfile: Lockfile = {
    version: LOCKFILE_VERSION,
    locked: new Date().toISOString(),
    host: hostname(),
    client: config.client,
    configPath: sanitizePath(config.configPath),
    servers,
  };

  return { lockfile, errors };
}

function buildServerEntry(
  config: MCPServerConfig,
  info: LiveServerInfo
): LockfileServer {
  const tools: Record<string, LockfileTool> = {};

  for (const tool of info.tools) {
    tools[tool.name] = {
      descriptionHash: hashValue(tool.description || ""),
      inputSchemaHash: hashValue(tool.inputSchema || {}),
      capabilities: inferCapabilities(tool.description || "", tool.name, tool.inputSchema),
    };
  }

  return {
    transport: config.transport || "stdio",
    command: config.command,
    args: config.args,
    url: config.url,
    envVars: config.env ? Object.keys(config.env) : undefined,
    protocolVersion: info.protocolVersion,
    serverName: info.serverName,
    serverVersion: info.serverVersion,
    tools,
    toolCount: info.tools.length,
  };
}

function buildConfigOnlyEntry(config: MCPServerConfig): LockfileServer {
  return {
    transport: config.transport || "stdio",
    command: config.command,
    args: config.args,
    url: config.url,
    envVars: config.env ? Object.keys(config.env) : undefined,
    tools: {},
    toolCount: 0,
  };
}

/**
 * Write lockfile to disk.
 */
export function writeLockfile(lockfile: Lockfile, outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(lockfile, null, 2) + "\n", "utf-8");
}

/**
 * Read lockfile from disk with validation.
 */
export function readLockfile(lockfilePath: string): Lockfile | null {
  if (!existsSync(lockfilePath)) return null;
  try {
    const raw = readFileSync(lockfilePath, "utf-8");
    const parsed = JSON.parse(raw, (key, value) => {
      // Block prototype pollution payloads
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return undefined;
      }
      return value;
    });
    // Validate basic structure
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.version !== "number" ||
      typeof parsed.servers !== "object"
    ) {
      return null;
    }
    if (Array.isArray(parsed.servers)) {
      return null;
    }
    if (parsed.version > LOCKFILE_VERSION) {
      throw new Error(
        `Lockfile version ${parsed.version} is newer than supported (${LOCKFILE_VERSION}). Please upgrade mcp-lock.`
      );
    }
    return parsed as Lockfile;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Lockfile version")) throw err;
    return null;
  }
}

/**
 * Replace home directory with ~ for privacy.
 */
function sanitizePath(p: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}
