import { Command } from "commander";
import { pinCommand } from "./commands/pin.js";
import { diffCommand } from "./commands/diff.js";
import { scanCommand } from "./commands/scan.js";
import { ciCommand } from "./commands/ci.js";
import { VERSION } from "./utils/constants.js";

const program = new Command();

program
  .name("mcp-lock")
  .description(
    "Supply chain security for MCP — pin, hash, detect drift in your AI tool chains"
  )
  .version(VERSION);

program
  .command("pin")
  .description("Generate lockfile from current MCP server configurations")
  .option("-c, --config <path>", "Path to MCP config file (auto-detected if omitted)")
  .option("-o, --output <path>", "Output lockfile path", "mcp-lock.json")
  .option("--timeout <ms>", "Connection timeout per server in ms", "10000")
  .option("--no-connect", "Pin from config only, without connecting to servers")
  .option("--json", "Output as JSON to stdout")
  .action(pinCommand);

program
  .command("diff")
  .description("Compare current state against lockfile — show what changed")
  .option("-l, --lockfile <path>", "Path to lockfile", "mcp-lock.json")
  .option("-c, --config <path>", "Path to MCP config file (auto-detected if omitted)")
  .option("--timeout <ms>", "Connection timeout per server in ms", "10000")
  .option("--json", "Output diff as JSON")
  .option("--no-connect", "Diff from config only, without connecting to servers")
  .action(diffCommand);

program
  .command("scan")
  .description("Audit MCP servers for vulnerabilities and misconfigurations")
  .option("-c, --config <path>", "Path to MCP config file (auto-detected if omitted)")
  .option("-l, --lockfile <path>", "Path to lockfile (optional, enriches scan)")
  .option("--rules <path>", "Custom rules file (.mcp-lock-rules.yaml)")
  .option("--severity <level>", "Minimum severity to report (low|medium|high|critical)", "low")
  .option("--timeout <ms>", "Connection timeout per server in ms", "10000")
  .option("--json", "Output as JSON")
  .option("--sarif", "Output as SARIF for GitHub Security tab")
  .action(scanCommand);

program
  .command("ci")
  .description("CI mode — exit 1 if lockfile doesn't match current state")
  .option("-l, --lockfile <path>", "Path to lockfile", "mcp-lock.json")
  .option("-c, --config <path>", "Path to MCP config file (auto-detected if omitted)")
  .option("--timeout <ms>", "Connection timeout per server in ms", "10000")
  .option("--strict", "Fail on any change (default: fail only on description/capability drift)")
  .option("--sarif <path>", "Write SARIF output to file")
  .action(ciCommand);

program.parse();
