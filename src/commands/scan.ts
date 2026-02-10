import ora from "ora";
import chalk from "chalk";
import { discoverConfig } from "../parsers/config-discovery.js";
import { readLockfile } from "../core/lockfile.js";
import { runScan, type ScanFinding, type FindingSeverity } from "../core/scanner.js";
import { log } from "../utils/logger.js";
import { EXIT_OK, EXIT_DRIFT, EXIT_ERROR, DEFAULT_TIMEOUT_MS } from "../utils/constants.js";

interface ScanOptions {
  config?: string;
  lockfile?: string;
  rules?: string;
  severity: string;
  timeout: string;
  json?: boolean;
  sarif?: boolean;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  // 1. Find config
  const config = discoverConfig(options.config);
  if (!config) {
    log.error("No MCP configuration found");
    process.exit(EXIT_ERROR);
  }

  const lockfile = options.lockfile ? readLockfile(options.lockfile) : null;

  // 2. Scan
  const spinner = ora(
    `Scanning ${Object.keys(config.servers).length} server(s)...`
  ).start();

  const timeoutMs = parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS;
  const minSeverity = (options.severity as FindingSeverity) || "low";

  const { scan, errors } = await runScan(config, {
    timeoutMs,
    minSeverity,
    lockfile,
    customRulesPath: options.rules,
  });

  spinner.stop();

  // Report errors
  for (const err of errors) {
    log.warn(`${err.server}: ${err.error}`);
  }

  // 3. Output
  if (options.json) {
    console.log(JSON.stringify(scan, null, 2));
    process.exit(scan.findings.length > 0 ? EXIT_DRIFT : EXIT_OK);
  }

  if (options.sarif) {
    console.log(JSON.stringify(toSarif(scan.findings), null, 2));
    process.exit(scan.findings.length > 0 ? EXIT_DRIFT : EXIT_OK);
  }

  // Console output
  console.log();
  log.info(
    `Scanned ${scan.serversScanned} server(s), ${scan.toolsScanned} tool(s)`
  );
  console.log();

  if (scan.findings.length === 0) {
    log.success("No security findings");
    process.exit(EXIT_OK);
  }

  // Group by severity
  const grouped = groupBySeverity(scan.findings);
  for (const severity of ["critical", "high", "medium", "low"] as FindingSeverity[]) {
    const findings = grouped[severity];
    if (!findings || findings.length === 0) continue;

    printSeverityGroup(severity, findings);
  }

  console.log();
  const total = scan.findings.length;
  const critHigh = scan.summary.critical + scan.summary.high;
  log.drift(
    `${total} finding(s): ${scan.summary.critical} critical, ${scan.summary.high} high, ${scan.summary.medium} medium, ${scan.summary.low} low`
  );

  if (critHigh > 0) {
    log.warn(`${critHigh} critical/high issue(s) require attention.`);
  }

  process.exit(scan.findings.length > 0 ? EXIT_DRIFT : EXIT_OK);
}

function groupBySeverity(
  findings: ScanFinding[]
): Record<FindingSeverity, ScanFinding[]> {
  const groups: Record<FindingSeverity, ScanFinding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const f of findings) groups[f.severity].push(f);
  return groups;
}

function printSeverityGroup(
  severity: FindingSeverity,
  findings: ScanFinding[]
): void {
  const noColor = !!process.env.NO_COLOR;
  const colors: Record<FindingSeverity, (s: string) => string> = {
    critical: noColor ? (s: string) => s : chalk.red.bold,
    high: noColor ? (s: string) => s : chalk.red,
    medium: noColor ? (s: string) => s : chalk.yellow,
    low: noColor ? (s: string) => s : chalk.blue,
  };

  console.log(colors[severity](`  ${severity.toUpperCase()} (${findings.length})`));

  for (const f of findings) {
    const location = f.tool ? `${f.server} → ${f.tool}` : f.server;
    console.log(`    [${f.ruleId}] ${f.title}`);
    console.log(`      ${location}`);
    console.log(`      ${f.detail}`);
    if (f.remediation) {
      const fix = noColor ? f.remediation : chalk.dim(f.remediation);
      console.log(`      Fix: ${fix}`);
    }
    console.log();
  }
}

/**
 * Convert findings to SARIF format for GitHub Security tab.
 */
function toSarif(findings: ScanFinding[]): object {
  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "mcp-lock",
            informationUri: "https://github.com/ace26597/mcp-lock",
            version: "0.1.0",
            rules: findings.map((f) => ({
              id: f.ruleId,
              shortDescription: { text: f.title },
              fullDescription: { text: f.detail },
              defaultConfiguration: {
                level: f.severity === "low" ? "note" : f.severity === "medium" ? "warning" : "error",
              },
            })),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level: f.severity === "low" ? "note" : f.severity === "medium" ? "warning" : "error",
          message: {
            text: `${f.title}: ${f.detail}`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: f.server,
                },
              },
            },
          ],
        })),
      },
    ],
  };
}
