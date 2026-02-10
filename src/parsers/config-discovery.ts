import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import type { MCPConfig, MCPServerConfig, ConfigLocation } from "./types.js";

/**
 * Known MCP client config file locations by platform.
 */
function getConfigLocations(): ConfigLocation[] {
  const home = homedir();
  const plat = platform();
  const locations: ConfigLocation[] = [];

  // Claude Desktop
  if (plat === "darwin") {
    locations.push({
      client: "claude-desktop",
      path: join(
        home,
        "Library/Application Support/Claude/claude_desktop_config.json"
      ),
      exists: false,
    });
  } else if (plat === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData/Roaming");
    locations.push({
      client: "claude-desktop",
      path: join(appData, "Claude/claude_desktop_config.json"),
      exists: false,
    });
  } else {
    locations.push({
      client: "claude-desktop",
      path: join(home, ".config/claude/claude_desktop_config.json"),
      exists: false,
    });
  }

  // Claude Code CLI
  locations.push({
    client: "claude-code",
    path: join(home, ".claude.json"),
    exists: false,
  });

  // Cursor
  if (plat === "darwin") {
    locations.push({
      client: "cursor",
      path: join(
        home,
        "Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json"
      ),
      exists: false,
    });
  } else if (plat === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData/Roaming");
    locations.push({
      client: "cursor",
      path: join(
        appData,
        "Cursor/User/globalStorage/cursor.mcp/mcp.json"
      ),
      exists: false,
    });
  } else {
    locations.push({
      client: "cursor",
      path: join(
        home,
        ".config/Cursor/User/globalStorage/cursor.mcp/mcp.json"
      ),
      exists: false,
    });
  }

  // VS Code (Copilot MCP)
  if (plat === "darwin") {
    locations.push({
      client: "vscode",
      path: join(home, "Library/Application Support/Code/User/settings.json"),
      exists: false,
    });
  } else if (plat === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData/Roaming");
    locations.push({
      client: "vscode",
      path: join(appData, "Code/User/settings.json"),
      exists: false,
    });
  } else {
    locations.push({
      client: "vscode",
      path: join(home, ".config/Code/User/settings.json"),
      exists: false,
    });
  }

  // Windsurf
  if (plat === "darwin") {
    locations.push({
      client: "windsurf",
      path: join(home, ".codeium/windsurf/mcp_config.json"),
      exists: false,
    });
  } else if (plat === "win32") {
    locations.push({
      client: "windsurf",
      path: join(home, ".codeium/windsurf/mcp_config.json"),
      exists: false,
    });
  } else {
    locations.push({
      client: "windsurf",
      path: join(home, ".codeium/windsurf/mcp_config.json"),
      exists: false,
    });
  }

  // Project-local (.mcp.json in CWD)
  locations.push({
    client: "project-local",
    path: join(process.cwd(), ".mcp.json"),
    exists: false,
  });

  // Check existence
  return locations.map((loc) => ({
    ...loc,
    exists: existsSync(loc.path),
  }));
}

/**
 * Auto-detect and parse the first available MCP config file.
 * Priority: explicit path > project-local > claude-code > claude-desktop > cursor > vscode > windsurf
 */
export function discoverConfig(explicitPath?: string): MCPConfig | null {
  if (explicitPath) {
    return parseConfigFile(explicitPath, "explicit");
  }

  const locations = getConfigLocations();
  const priority = [
    "project-local",
    "claude-code",
    "claude-desktop",
    "cursor",
    "vscode",
    "windsurf",
  ];

  for (const client of priority) {
    const loc = locations.find((l) => l.client === client && l.exists);
    if (loc) {
      return parseConfigFile(loc.path, loc.client);
    }
  }

  return null;
}

/**
 * List all detected MCP config file locations (for diagnostics).
 */
export function listConfigLocations(): ConfigLocation[] {
  return getConfigLocations();
}

/**
 * Parse an MCP config file and extract server definitions.
 * Handles JSONC (comments), different key names per client.
 */
function parseConfigFile(
  configPath: string,
  client: string
): MCPConfig | null {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parseJsonc(raw);

    if (!parsed || typeof parsed !== "object") return null;

    let servers: Record<string, MCPServerConfig> = {};

    // Claude Desktop / Cursor / Windsurf: { "mcpServers": { ... } }
    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      servers = normalizeServers(parsed.mcpServers);
    }
    // Claude Code CLI: { "mcpServers": { ... } } (same key)
    // VS Code: { "mcp": { "servers": { ... } } }
    else if (
      parsed.mcp?.servers &&
      typeof parsed.mcp.servers === "object"
    ) {
      servers = normalizeServers(parsed.mcp.servers);
    }
    // Direct servers key
    else if (parsed.servers && typeof parsed.servers === "object") {
      servers = normalizeServers(parsed.servers);
    }

    if (Object.keys(servers).length === 0) return null;

    return { client, configPath, servers };
  } catch {
    return null;
  }
}

/**
 * Normalize server configs — different clients use slightly different schemas.
 */
function normalizeServers(
  raw: Record<string, unknown>
): Record<string, MCPServerConfig> {
  const servers: Record<string, MCPServerConfig> = {};

  for (const [name, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;

    servers[name] = {
      transport: inferTransport(v),
      command: typeof v.command === "string" ? v.command : undefined,
      args: Array.isArray(v.args)
        ? v.args.filter((a): a is string => typeof a === "string")
        : undefined,
      url: typeof v.url === "string" ? v.url : undefined,
      env:
        v.env && typeof v.env === "object"
          ? (v.env as Record<string, string>)
          : undefined,
    };
  }

  return servers;
}

function inferTransport(
  config: Record<string, unknown>
): "stdio" | "sse" | "streamable-http" {
  if (config.transport === "sse") return "sse";
  if (config.transport === "streamable-http") return "streamable-http";
  if (typeof config.url === "string") return "sse";
  return "stdio";
}
