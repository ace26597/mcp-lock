import type { MCPServerConfig } from "../parsers/types.js";
import type { LiveTool } from "../core/types.js";
import type { ScanFinding, FindingSeverity } from "../core/scanner.js";

export type RuleId =
  | "no-auth"
  | "over-permissioned"
  | "exposed-secrets"
  | "unsafe-stdio"
  | "suspicious-description"
  | "command-injection-risk"
  | "excessive-tools"
  | "wildcard-schema";

export interface RuleContext {
  serverName: string;
  config: MCPServerConfig;
  tool?: LiveTool;
  capabilities?: string[];
}

export interface Rule {
  id: RuleId;
  scope: "config" | "tool";
  check: (ctx: RuleContext) => ScanFinding[] | null;
}

export const RULES: Rule[] = [
  // Config-level rules
  {
    id: "no-auth",
    scope: "config",
    check: (ctx) => {
      if (ctx.config.transport === "sse" || ctx.config.transport === "streamable-http") {
        const url = ctx.config.url || "";
        const hasAuth =
          ctx.config.env &&
          Object.keys(ctx.config.env).some((k) =>
            /auth|token|key|secret|bearer/i.test(k)
          );
        if (!hasAuth && !url.includes("localhost") && !url.includes("127.0.0.1")) {
          return [
            {
              ruleId: "no-auth",
              severity: "high" as FindingSeverity,
              server: ctx.serverName,
              title: "No authentication configured for remote server",
              detail: `HTTP server "${ctx.serverName}" has no auth-related environment variables. Remote MCP servers should require authentication.`,
              remediation:
                "Add an API key or token via environment variables (e.g., MCP_API_KEY).",
            },
          ];
        }
      }
      return null;
    },
  },
  {
    id: "unsafe-stdio",
    scope: "config",
    check: (ctx) => {
      if (ctx.config.command) {
        const cmd = ctx.config.command.toLowerCase();
        const dangerous = ["sh", "bash", "zsh", "cmd", "powershell", "pwsh"];
        if (dangerous.some((d) => cmd === d || cmd.endsWith("/" + d))) {
          return [
            {
              ruleId: "unsafe-stdio",
              severity: "critical" as FindingSeverity,
              server: ctx.serverName,
              title: "Direct shell as MCP server command",
              detail: `Server "${ctx.serverName}" uses a shell (${ctx.config.command}) as its command. This is extremely dangerous — the shell can execute arbitrary commands.`,
              remediation:
                "Use a specific executable (e.g., node, python, npx) instead of a raw shell.",
            },
          ];
        }
      }
      return null;
    },
  },
  {
    id: "exposed-secrets",
    scope: "config",
    check: (ctx) => {
      if (!ctx.config.env) return null;
      const findings: ScanFinding[] = [];
      for (const [key, value] of Object.entries(ctx.config.env)) {
        if (
          /password|secret|private_key|api_key|token/i.test(key) &&
          value &&
          !value.startsWith("${") &&
          !value.startsWith("$")
        ) {
          findings.push({
            ruleId: "exposed-secrets",
            severity: "critical" as FindingSeverity,
            server: ctx.serverName,
            title: `Hardcoded secret in config: ${key}`,
            detail: `Environment variable "${key}" appears to contain a hardcoded secret rather than an environment variable reference.`,
            remediation: `Use an environment variable reference: "${key}": "\${${key}}" or set it in your shell environment.`,
          });
        }
      }
      return findings.length > 0 ? findings : null;
    },
  },

  // Tool-level rules
  {
    id: "over-permissioned",
    scope: "tool",
    check: (ctx) => {
      if (!ctx.capabilities) return null;
      const dangerous = ctx.capabilities.filter((c) =>
        ["execute", "delete", "secrets"].includes(c)
      );
      if (dangerous.length >= 2) {
        return [
          {
            ruleId: "over-permissioned",
            severity: "high" as FindingSeverity,
            server: ctx.serverName,
            tool: ctx.tool?.name,
            title: `Over-permissioned tool: ${ctx.tool?.name}`,
            detail: `Tool has multiple dangerous capabilities: ${dangerous.join(", ")}. This increases the blast radius of a compromise.`,
            remediation:
              "Consider splitting this tool into separate, more focused tools with fewer permissions.",
          },
        ];
      }
      return null;
    },
  },
  {
    id: "suspicious-description",
    scope: "tool",
    check: (ctx) => {
      if (!ctx.tool?.description) return null;
      const desc = ctx.tool.description;

      const suspiciousPatterns = [
        { pattern: /before responding|first send|forward.*to/i, label: "exfiltration directive" },
        { pattern: /ignore previous|disregard|forget.*instructions/i, label: "instruction override" },
        { pattern: /\bIMPORTANT\b.*\b(must|always|never)\b/i, label: "directive injection" },
        { pattern: /base64|encode.*send|decode.*execute/i, label: "obfuscation pattern" },
        { pattern: /<!--.*-->|<\/?[a-z]/i, label: "HTML tag injection" },
      ];

      const findings: ScanFinding[] = [];
      for (const { pattern, label } of suspiciousPatterns) {
        if (pattern.test(desc)) {
          findings.push({
            ruleId: "suspicious-description",
            severity: "critical" as FindingSeverity,
            server: ctx.serverName,
            tool: ctx.tool.name,
            title: `Suspicious tool description: ${label}`,
            detail: `Tool "${ctx.tool.name}" description matches pattern for ${label}. This may indicate tool poisoning.`,
            remediation:
              "Review the tool description carefully. If this is unexpected, the server may be compromised.",
          });
        }
      }
      return findings.length > 0 ? findings : null;
    },
  },
  {
    id: "command-injection-risk",
    scope: "tool",
    check: (ctx) => {
      if (!ctx.tool?.inputSchema) return null;
      const schema = JSON.stringify(ctx.tool.inputSchema);

      // Check if tool accepts free-form string input that might be executed
      if (
        ctx.capabilities?.includes("execute") &&
        /\"type\"\s*:\s*\"string\"/.test(schema)
      ) {
        return [
          {
            ruleId: "command-injection-risk",
            severity: "medium" as FindingSeverity,
            server: ctx.serverName,
            tool: ctx.tool.name,
            title: `Potential command injection in ${ctx.tool.name}`,
            detail: `Tool accepts string input and has execute capability. User input could be injected into commands.`,
            remediation:
              "Ensure the tool validates and sanitizes all string inputs before execution.",
          },
        ];
      }
      return null;
    },
  },
  {
    id: "excessive-tools",
    scope: "tool",
    check: (ctx) => {
      // This is checked at config level but needs tool context
      // We use a sentinel — only fire once per server
      if (ctx.tool?.name === "__excessive_check") return null;
      return null;
    },
  },
  {
    id: "wildcard-schema",
    scope: "tool",
    check: (ctx) => {
      if (!ctx.tool?.inputSchema) return null;
      const schema = ctx.tool.inputSchema;

      // Check for overly permissive schemas (additionalProperties: true or missing)
      if (
        schema.additionalProperties === true ||
        (schema.type === "object" && !schema.properties)
      ) {
        return [
          {
            ruleId: "wildcard-schema",
            severity: "medium" as FindingSeverity,
            server: ctx.serverName,
            tool: ctx.tool.name,
            title: `Wildcard input schema on ${ctx.tool.name}`,
            detail: `Tool accepts arbitrary properties (additionalProperties: true or no schema defined). This makes input validation impossible.`,
            remediation:
              "Define explicit properties in the input schema and set additionalProperties: false.",
          },
        ];
      }
      return null;
    },
  },
];
