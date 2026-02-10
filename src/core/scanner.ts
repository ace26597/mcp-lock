import type { MCPConfig, MCPServerConfig } from "../parsers/types.js";
import type { Lockfile } from "./types.js";
import { connectAndListTools } from "./connector.js";
import { inferCapabilities } from "./capabilities.js";
import { RULES, type RuleId } from "../rules/index.js";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export interface ScanFinding {
  ruleId: RuleId;
  severity: FindingSeverity;
  server: string;
  tool?: string;
  title: string;
  detail: string;
  remediation?: string;
}

export interface ScanResult {
  findings: ScanFinding[];
  serversScanned: number;
  toolsScanned: number;
  summary: Record<FindingSeverity, number>;
}

/**
 * Scan MCP servers for vulnerabilities and misconfigurations.
 * Applies built-in rules + optional custom rules.
 */
export async function runScan(
  config: MCPConfig,
  options: {
    timeoutMs: number;
    minSeverity: FindingSeverity;
    lockfile?: Lockfile | null;
  }
): Promise<{ scan: ScanResult; errors: Array<{ server: string; error: string }> }> {
  const findings: ScanFinding[] = [];
  const errors: Array<{ server: string; error: string }> = [];
  let toolsScanned = 0;

  for (const [name, serverConfig] of Object.entries(config.servers)) {
    // Run config-level rules (no connection needed)
    for (const rule of RULES) {
      if (rule.scope === "config") {
        const result = rule.check({ serverName: name, config: serverConfig });
        if (result) findings.push(...result);
      }
    }

    // Connect and run tool-level rules
    try {
      const info = await connectAndListTools(name, serverConfig, options.timeoutMs);
      toolsScanned += info.tools.length;

      for (const tool of info.tools) {
        for (const rule of RULES) {
          if (rule.scope === "tool") {
            const result = rule.check({
              serverName: name,
              config: serverConfig,
              tool,
              capabilities: inferCapabilities(tool.description || "", tool.name),
            });
            if (result) findings.push(...result);
          }
        }
      }
    } catch (err) {
      errors.push({
        server: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Filter by minimum severity
  const severityOrder: FindingSeverity[] = ["low", "medium", "high", "critical"];
  const minIdx = severityOrder.indexOf(options.minSeverity);
  const filtered = findings.filter(
    (f) => severityOrder.indexOf(f.severity) >= minIdx
  );

  const summary: Record<FindingSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const f of filtered) summary[f.severity]++;

  return {
    scan: {
      findings: filtered,
      serversScanned: Object.keys(config.servers).length,
      toolsScanned,
      summary,
    },
    errors,
  };
}
