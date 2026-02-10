import ora from "ora";
import chalk from "chalk";
import { discoverConfig } from "../parsers/config-discovery.js";
import { readLockfile } from "../core/lockfile.js";
import { computeDiff, type DiffEntry } from "../core/differ.js";
import { log } from "../utils/logger.js";
import { EXIT_OK, EXIT_DRIFT, EXIT_ERROR, DEFAULT_TIMEOUT_MS } from "../utils/constants.js";

interface DiffOptions {
  lockfile: string;
  config?: string;
  timeout: string;
  connect: boolean;
  json?: boolean;
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  // 1. Load lockfile
  const lockfile = readLockfile(options.lockfile);
  if (!lockfile) {
    log.error(`Lockfile not found: ${options.lockfile}`);
    log.info('Run "mcp-lock pin" to generate a lockfile first.');
    process.exit(EXIT_ERROR);
  }

  // 2. Find config
  const config = discoverConfig(options.config);
  if (!config) {
    log.error("No MCP configuration found");
    process.exit(EXIT_ERROR);
  }

  // 3. Compute diff
  const spinner = options.connect
    ? ora("Comparing against live servers...").start()
    : ora("Comparing against config...").start();

  const timeoutMs = parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS;
  const { diff, errors } = await computeDiff(lockfile, config, {
    timeoutMs,
    connect: options.connect,
  });

  spinner.stop();

  // Report errors
  for (const err of errors) {
    log.warn(`${err.server}: ${err.error}`);
  }

  // 4. Output
  if (options.json) {
    console.log(JSON.stringify(diff, null, 2));
    process.exit(diff.drifted ? EXIT_DRIFT : EXIT_OK);
  }

  if (!diff.drifted) {
    log.success("No drift detected — lockfile matches current state");
    process.exit(EXIT_OK);
  }

  // Display diff entries
  console.log();
  for (const entry of diff.entries) {
    printDiffEntry(entry);
  }

  console.log();
  log.drift(
    `${diff.entries.length} change(s) detected: ${diff.summary.critical} critical, ${diff.summary.warning} warning, ${diff.summary.info} info`
  );
  log.info('Run "mcp-lock pin" to accept current state as new baseline.');

  process.exit(EXIT_DRIFT);
}

function printDiffEntry(entry: DiffEntry): void {
  const noColor = !!process.env.NO_COLOR;
  const severityColors = {
    critical: noColor ? "CRITICAL" : chalk.red.bold("CRITICAL"),
    warning: noColor ? "WARNING" : chalk.yellow("WARNING"),
    info: noColor ? "INFO" : chalk.blue("INFO"),
  };

  const prefix = severityColors[entry.severity];
  const location = entry.tool
    ? `${entry.server} → ${entry.tool}`
    : entry.server;

  console.log(`  ${prefix}  ${location}`);
  console.log(`          ${entry.detail}`);

  if (entry.oldValue && entry.newValue) {
    const old = noColor ? `- ${entry.oldValue}` : chalk.red(`- ${entry.oldValue}`);
    const neu = noColor ? `+ ${entry.newValue}` : chalk.green(`+ ${entry.newValue}`);
    console.log(`          ${old}`);
    console.log(`          ${neu}`);
  }
  console.log();
}
