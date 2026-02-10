import ora from "ora";
import { discoverConfig } from "../parsers/config-discovery.js";
import { readLockfile } from "../core/lockfile.js";
import { computeDiff } from "../core/differ.js";
import { log } from "../utils/logger.js";
import { EXIT_OK, EXIT_DRIFT, EXIT_ERROR, DEFAULT_TIMEOUT_MS } from "../utils/constants.js";
import { writeFileSync } from "node:fs";

interface CiOptions {
  lockfile: string;
  config?: string;
  timeout: string;
  strict?: boolean;
  sarif?: string;
}

export async function ciCommand(options: CiOptions): Promise<void> {
  // 1. Load lockfile
  const lockfile = readLockfile(options.lockfile);
  if (!lockfile) {
    log.error(`Lockfile not found: ${options.lockfile}`);
    log.error("CI check failed — no baseline to compare against.");
    process.exit(EXIT_ERROR);
  }

  // 2. Find config
  const config = discoverConfig(options.config);
  if (!config) {
    log.error("No MCP configuration found");
    process.exit(EXIT_ERROR);
  }

  // 3. Compute diff
  const spinner = ora("Checking lockfile against live servers...").start();

  const timeoutMs = parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS;
  const { diff, errors } = await computeDiff(lockfile, config, {
    timeoutMs,
    connect: true,
  });

  spinner.stop();

  // 4. Determine pass/fail
  const criticalEntries = diff.entries.filter((e) => e.severity === "critical");
  const allEntries = diff.entries;

  const shouldFail = options.strict
    ? allEntries.length > 0
    : criticalEntries.length > 0;

  // 5. Output for CI
  if (!diff.drifted) {
    log.success("mcp-lock: OK — no drift detected");
    process.exit(EXIT_OK);
  }

  // Report all changes
  for (const entry of diff.entries) {
    const icon = entry.severity === "critical" ? "::error" : "::warning";
    // GitHub Actions annotation format
    console.log(
      `${icon} file=mcp-lock.json::${entry.server}${entry.tool ? ` → ${entry.tool}` : ""}: ${entry.detail}`
    );
  }

  // Write SARIF if requested
  if (options.sarif) {
    // Generic rule descriptions (not instance-specific)
    const ruleDescriptions: Record<string, string> = {
      "description-changed": "Tool description hash changed (possible tool poisoning)",
      "schema-changed": "Tool input schema changed",
      "capability-changed": "Tool capabilities changed",
      "tool-added": "New tool appeared",
      "tool-removed": "Tool was removed",
      "server-added": "New server appeared",
      "server-removed": "Server was removed",
      "version-changed": "Server version changed",
      "tool-count-changed": "Tool count changed",
    };

    // Deduplicate rule IDs for SARIF rules array
    const ruleMap = new Map<string, { id: string; description: string }>();
    for (const e of diff.entries) {
      if (!ruleMap.has(e.type)) {
        ruleMap.set(e.type, {
          id: e.type,
          description: ruleDescriptions[e.type] || e.type,
        });
      }
    }

    const sarif = {
      $schema:
        "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "mcp-lock",
              version: "0.1.0",
              informationUri: "https://github.com/blestlabs/mcp-lock",
              rules: [...ruleMap.values()].map((r) => ({
                id: r.id,
                shortDescription: { text: r.description },
              })),
            },
          },
          results: diff.entries.map((e) => ({
            ruleId: e.type,
            level: e.severity === "critical" ? "error" : "warning",
            message: { text: e.detail },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: "mcp-lock.json" },
                },
              },
            ],
          })),
        },
      ],
    };

    writeFileSync(options.sarif, JSON.stringify(sarif, null, 2));
    log.info(`SARIF output written to ${options.sarif}`);
  }

  // Summary
  console.log();
  log.drift(
    `mcp-lock: DRIFT DETECTED — ${diff.summary.critical} critical, ${diff.summary.warning} warning, ${diff.summary.info} info`
  );

  if (shouldFail) {
    log.error(
      options.strict
        ? 'CI failed — drift detected (strict mode). Run "mcp-lock pin" to update.'
        : 'CI failed — critical drift detected. Run "mcp-lock pin" to update.'
    );
    process.exit(EXIT_DRIFT);
  }

  // Warnings only — pass with annotations
  log.warn("CI passed with warnings. Consider updating your lockfile.");
  process.exit(EXIT_OK);
}
