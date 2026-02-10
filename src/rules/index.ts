import type { MCPServerConfig } from "../parsers/types.js";
import type { LiveTool } from "../core/types.js";
import type { ScanFinding, FindingSeverity } from "../core/scanner.js";

export type BuiltinRuleId =
  | "no-auth"
  | "over-permissioned"
  | "exposed-secrets"
  | "unsafe-stdio"
  | "suspicious-description"
  | "command-injection-risk"
  | "wildcard-schema"
  | "tool-shadowing"
  | "unicode-obfuscation";

/** Rule IDs: built-in IDs or custom string IDs from YAML rules */
export type RuleId = BuiltinRuleId | (string & {});

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
        { pattern: /before responding|first send|forward.{0,100}to/i, label: "exfiltration directive" },
        { pattern: /ignore previous|disregard|forget.{0,50}instructions/i, label: "instruction override" },
        { pattern: /\bIMPORTANT\b.{0,100}\b(must|always|never)\b/i, label: "directive injection" },
        { pattern: /base64|encode.{0,50}send|decode.{0,50}execute/i, label: "obfuscation pattern" },
        { pattern: /<!--[\s\S]{0,500}-->|<\/?[a-z]/i, label: "HTML tag injection" },
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
  {
    id: "unicode-obfuscation",
    scope: "tool",
    check: (ctx) => {
      if (!ctx.tool) return null;
      const findings: ScanFinding[] = [];

      // Cyrillic homoglyphs that look like Latin letters
      const cyrillicHomoglyphs =
        "\u0430\u0435\u043E\u0440\u0441\u0445\u0443" + // lowercase: а е о р с х у
        "\u0410\u0412\u0415\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425"; // uppercase: А В Е К М Н О Р С Т Х
      const cyrillicHomoglyphSet = new Set(cyrillicHomoglyphs);

      // Zero-width characters that can hide text
      const zeroWidthChars = new Set([
        "\u200B", // zero-width space
        "\u200C", // zero-width non-joiner
        "\u200D", // zero-width joiner
        "\uFEFF", // zero-width no-break space (BOM)
      ]);

      const latinPattern = /[a-zA-Z]/;
      const cyrillicRangePattern = /[\u0400-\u04FF]/;

      function checkText(text: string, location: string): void {
        // Check for Cyrillic homoglyphs mixed with Latin letters
        const hasLatin = latinPattern.test(text);
        const hasCyrillic = cyrillicRangePattern.test(text);

        if (hasLatin && hasCyrillic) {
          // Find specific homoglyphs
          const foundHomoglyphs: string[] = [];
          for (const char of text) {
            if (cyrillicHomoglyphSet.has(char)) {
              const codePoint = char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
              foundHomoglyphs.push(`U+${codePoint}`);
            }
          }
          if (foundHomoglyphs.length > 0) {
            findings.push({
              ruleId: "unicode-obfuscation",
              severity: "critical" as FindingSeverity,
              server: ctx.serverName,
              tool: ctx.tool!.name,
              title: `Unicode homoglyph obfuscation in tool ${location}`,
              detail: `Tool "${ctx.tool!.name}" ${location} contains Cyrillic characters that visually mimic Latin letters (${[...new Set(foundHomoglyphs)].join(", ")}). This is a common technique to bypass text-based security checks.`,
              remediation:
                "Replace all Cyrillic homoglyphs with their ASCII Latin equivalents. If this is unexpected, the server may be compromised.",
            });
          }
        }

        // Check for zero-width characters
        const foundZeroWidth: string[] = [];
        for (const char of text) {
          if (zeroWidthChars.has(char)) {
            const codePoint = char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
            foundZeroWidth.push(`U+${codePoint}`);
          }
        }
        if (foundZeroWidth.length > 0) {
          findings.push({
            ruleId: "unicode-obfuscation",
            severity: "critical" as FindingSeverity,
            server: ctx.serverName,
            tool: ctx.tool!.name,
            title: `Zero-width characters in tool ${location}`,
            detail: `Tool "${ctx.tool!.name}" ${location} contains zero-width Unicode characters (${[...new Set(foundZeroWidth)].join(", ")}). These invisible characters can hide malicious text from human review.`,
            remediation:
              "Remove all zero-width characters. If this is unexpected, the server may be compromised.",
          });
        }
      }

      checkText(ctx.tool.name, "name");
      if (ctx.tool.description) {
        checkText(ctx.tool.description, "description");
      }

      return findings.length > 0 ? findings : null;
    },
  },
];
