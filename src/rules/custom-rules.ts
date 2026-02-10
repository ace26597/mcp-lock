import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import type { Rule, RuleContext } from "./index.js";
import type { ScanFinding, FindingSeverity } from "../core/scanner.js";

/**
 * Schema for a single custom rule in the YAML file.
 */
interface CustomRuleYaml {
  id: string;
  scope: "config" | "tool";
  severity: FindingSeverity;
  title: string;
  detail?: string;
  remediation?: string;
  /** Match against tool description */
  description?: { pattern: string; flags?: string };
  /** Match against tool name */
  name?: { pattern: string; flags?: string };
  /** Match against stringified inputSchema */
  schema?: { pattern: string; flags?: string };
}

interface CustomRulesFile {
  rules: CustomRuleYaml[];
}

/**
 * Load custom rules from a YAML file and return them as Rule[] compatible
 * with the built-in rule engine.
 */
export function loadCustomRules(rulesPath: string): Rule[] {
  const raw = readFileSync(rulesPath, "utf-8");
  const parsed = yaml.load(raw) as CustomRulesFile;

  if (!parsed || !Array.isArray(parsed.rules)) {
    throw new Error(
      `Invalid custom rules file: expected a "rules" array in ${rulesPath}`
    );
  }

  return parsed.rules.map((entry) => yamlRuleToRule(entry, rulesPath));
}

function yamlRuleToRule(entry: CustomRuleYaml, filePath: string): Rule {
  if (!entry.id || !entry.scope || !entry.severity || !entry.title) {
    throw new Error(
      `Custom rule in ${filePath} is missing required fields (id, scope, severity, title)`
    );
  }

  // Pre-compile regex patterns
  const descriptionRe = entry.description
    ? new RegExp(entry.description.pattern, entry.description.flags ?? "")
    : null;
  const nameRe = entry.name
    ? new RegExp(entry.name.pattern, entry.name.flags ?? "")
    : null;
  const schemaRe = entry.schema
    ? new RegExp(entry.schema.pattern, entry.schema.flags ?? "")
    : null;

  return {
    id: entry.id,
    scope: entry.scope,
    check: (ctx: RuleContext): ScanFinding[] | null => {
      // For tool-scoped rules, we need a tool present
      if (entry.scope === "tool" && !ctx.tool) return null;

      const findings: ScanFinding[] = [];

      // Check name pattern
      if (nameRe) {
        const target =
          entry.scope === "tool" ? ctx.tool?.name : ctx.serverName;
        if (target && nameRe.test(target)) {
          findings.push(buildFinding(entry, ctx));
        }
      }

      // Check description pattern
      if (descriptionRe) {
        const target =
          entry.scope === "tool" ? ctx.tool?.description : undefined;
        if (target && descriptionRe.test(target)) {
          findings.push(buildFinding(entry, ctx));
        }
      }

      // Check schema pattern (tool-scope only)
      if (schemaRe && entry.scope === "tool" && ctx.tool?.inputSchema) {
        const schemaStr = JSON.stringify(ctx.tool.inputSchema);
        if (schemaRe.test(schemaStr)) {
          findings.push(buildFinding(entry, ctx));
        }
      }

      return findings.length > 0 ? findings : null;
    },
  };
}

function buildFinding(entry: CustomRuleYaml, ctx: RuleContext): ScanFinding {
  return {
    ruleId: entry.id,
    severity: entry.severity,
    server: ctx.serverName,
    tool: ctx.tool?.name,
    title: entry.title,
    detail: entry.detail ?? entry.title,
    remediation: entry.remediation,
  };
}
