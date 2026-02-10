import type { Lockfile, LockfileServer, LockfileTool, LiveServerInfo } from "./types.js";
import type { MCPConfig } from "../parsers/types.js";
import { hashValue } from "../utils/hash.js";
import { connectAndListTools } from "./connector.js";
import { inferCapabilities } from "./capabilities.js";

export type DiffSeverity = "info" | "warning" | "critical";

export interface DiffEntry {
  server: string;
  tool?: string;
  type:
    | "server-added"
    | "server-removed"
    | "tool-added"
    | "tool-removed"
    | "description-changed"
    | "schema-changed"
    | "capability-changed"
    | "version-changed"
    | "tool-count-changed";
  severity: DiffSeverity;
  detail: string;
  oldValue?: string;
  newValue?: string;
}

export interface DiffResult {
  drifted: boolean;
  entries: DiffEntry[];
  summary: { critical: number; warning: number; info: number };
}

/**
 * Compare current MCP server state against a pinned lockfile.
 */
export async function computeDiff(
  lockfile: Lockfile,
  config: MCPConfig,
  options: { timeoutMs: number; connect: boolean }
): Promise<{ diff: DiffResult; errors: Array<{ server: string; error: string }> }> {
  const entries: DiffEntry[] = [];
  const errors: Array<{ server: string; error: string }> = [];

  // Check for removed servers (in lockfile but not in config)
  for (const name of Object.keys(lockfile.servers)) {
    if (!config.servers[name]) {
      entries.push({
        server: name,
        type: "server-removed",
        severity: "warning",
        detail: `Server "${name}" was removed from config`,
      });
    }
  }

  // Check for added servers (in config but not in lockfile)
  for (const name of Object.keys(config.servers)) {
    if (!lockfile.servers[name]) {
      entries.push({
        server: name,
        type: "server-added",
        severity: "warning",
        detail: `Server "${name}" was added to config (not pinned)`,
      });
    }
  }

  // Check servers present in both
  for (const [name, lockedServer] of Object.entries(lockfile.servers)) {
    const currentConfig = config.servers[name];
    if (!currentConfig) continue;

    if (options.connect) {
      try {
        const liveInfo = await connectAndListTools(name, currentConfig, options.timeoutMs);
        diffServerTools(name, lockedServer, liveInfo, entries);
      } catch (err) {
        errors.push({
          server: name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const summary = {
    critical: entries.filter((e) => e.severity === "critical").length,
    warning: entries.filter((e) => e.severity === "warning").length,
    info: entries.filter((e) => e.severity === "info").length,
  };

  return {
    diff: {
      drifted: entries.length > 0,
      entries,
      summary,
    },
    errors,
  };
}

function diffServerTools(
  serverName: string,
  locked: LockfileServer,
  live: LiveServerInfo,
  entries: DiffEntry[]
): void {
  // Version change
  if (locked.serverVersion && live.serverVersion && locked.serverVersion !== live.serverVersion) {
    entries.push({
      server: serverName,
      type: "version-changed",
      severity: "info",
      detail: `Server version changed`,
      oldValue: locked.serverVersion,
      newValue: live.serverVersion,
    });
  }

  // Tool count change
  if (locked.toolCount !== live.tools.length) {
    entries.push({
      server: serverName,
      type: "tool-count-changed",
      severity: "warning",
      detail: `Tool count changed from ${locked.toolCount} to ${live.tools.length}`,
      oldValue: String(locked.toolCount),
      newValue: String(live.tools.length),
    });
  }

  const liveToolMap = new Map(live.tools.map((t) => [t.name, t]));

  // Check for removed tools
  for (const toolName of Object.keys(locked.tools)) {
    if (!liveToolMap.has(toolName)) {
      entries.push({
        server: serverName,
        tool: toolName,
        type: "tool-removed",
        severity: "warning",
        detail: `Tool "${toolName}" was removed`,
      });
    }
  }

  // Check for added tools
  for (const tool of live.tools) {
    if (!locked.tools[tool.name]) {
      entries.push({
        server: serverName,
        tool: tool.name,
        type: "tool-added",
        severity: "warning",
        detail: `New tool "${tool.name}" appeared`,
      });
    }
  }

  // Check existing tools for drift
  for (const [toolName, lockedTool] of Object.entries(locked.tools)) {
    const liveTool = liveToolMap.get(toolName);
    if (!liveTool) continue;

    const liveDescHash = hashValue(liveTool.description || "");
    const liveSchemaHash = hashValue(liveTool.inputSchema || {});
    const liveCaps = inferCapabilities(liveTool.description || "", toolName);

    // Description drift — CRITICAL (possible tool poisoning)
    if (lockedTool.descriptionHash !== liveDescHash) {
      entries.push({
        server: serverName,
        tool: toolName,
        type: "description-changed",
        severity: "critical",
        detail: `Tool description changed (possible tool poisoning)`,
        oldValue: lockedTool.descriptionHash,
        newValue: liveDescHash,
      });
    }

    // Schema drift
    if (lockedTool.inputSchemaHash !== liveSchemaHash) {
      entries.push({
        server: serverName,
        tool: toolName,
        type: "schema-changed",
        severity: "warning",
        detail: `Input schema changed`,
        oldValue: lockedTool.inputSchemaHash,
        newValue: liveSchemaHash,
      });
    }

    // Capability escalation
    const newCaps = liveCaps.filter((c) => !lockedTool.capabilities.includes(c));
    if (newCaps.length > 0) {
      entries.push({
        server: serverName,
        tool: toolName,
        type: "capability-changed",
        severity: "critical",
        detail: `New capabilities detected: ${newCaps.join(", ")}`,
        oldValue: lockedTool.capabilities.join(", "),
        newValue: liveCaps.join(", "),
      });
    }
  }
}
