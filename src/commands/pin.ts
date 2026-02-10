import ora from "ora";
import { discoverConfig } from "../parsers/config-discovery.js";
import { generateLockfile, writeLockfile } from "../core/lockfile.js";
import { log } from "../utils/logger.js";
import { EXIT_OK, EXIT_ERROR, DEFAULT_TIMEOUT_MS } from "../utils/constants.js";

interface PinOptions {
  config?: string;
  output: string;
  timeout: string;
  connect: boolean;
  json?: boolean;
}

export async function pinCommand(options: PinOptions): Promise<void> {
  const spinner = ora("Discovering MCP configuration...").start();

  // 1. Find config
  const config = discoverConfig(options.config);
  if (!config) {
    spinner.fail("No MCP configuration found");
    log.error(
      "Searched: claude-code (~/.claude.json), claude-desktop, cursor, vscode, windsurf"
    );
    log.info("Use --config <path> to specify a config file explicitly.");
    process.exit(EXIT_ERROR);
  }

  spinner.text = `Found ${config.client} config: ${config.configPath}`;
  spinner.succeed();

  const serverCount = Object.keys(config.servers).length;
  log.info(`${serverCount} server(s) configured`);

  // 2. Connect and pin
  const connectSpinner = options.connect
    ? ora(`Connecting to ${serverCount} server(s)...`).start()
    : null;

  const timeoutMs = parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS;
  const { lockfile, errors } = await generateLockfile(config, {
    timeoutMs,
    connect: options.connect,
  });

  if (connectSpinner) {
    if (errors.length > 0) {
      connectSpinner.warn(
        `Connected with ${errors.length} error(s)`
      );
    } else {
      connectSpinner.succeed("All servers connected");
    }
  }

  // Report errors
  for (const err of errors) {
    log.warn(`${err.server}: ${err.error}`);
  }

  // 3. Output
  if (options.json) {
    console.log(JSON.stringify(lockfile, null, 2));
  } else {
    writeLockfile(lockfile, options.output);
    log.success(`Lockfile written to ${options.output}`);

    // Summary
    const totalTools = Object.values(lockfile.servers).reduce(
      (sum, s) => sum + s.toolCount,
      0
    );
    log.info(
      `Pinned ${Object.keys(lockfile.servers).length} server(s), ${totalTools} tool(s)`
    );
    log.dim("Commit mcp-lock.json to your repository to track changes.");
  }

  process.exit(EXIT_OK);
}
