import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const CLI = join(import.meta.dirname, "../../dist/cli.js");
const FIXTURES = join(import.meta.dirname, "../fixtures");
const SERVERS = join(import.meta.dirname, "../servers");
const LOCKFILE = "/tmp/mcp-lock-integration-test.json";

function runCli(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: join(import.meta.dirname, "../.."),
      env: { ...process.env, NO_COLOR: "1" },
    }).toString();
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout?.toString() || "", exitCode: err.status || 2 };
  }
}

/** Extract JSON object from mixed stdout (may contain spinner artifacts) */
function extractJson(stdout: string): any | null {
  // Find the first complete JSON object
  const start = stdout.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < stdout.length; i++) {
    if (stdout[i] === "{") depth++;
    if (stdout[i] === "}") depth--;
    if (depth === 0) {
      try {
        return JSON.parse(stdout.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

describe("mcp-lock end-to-end workflow", () => {
  afterAll(() => {
    if (existsSync(LOCKFILE)) unlinkSync(LOCKFILE);
  });

  describe("pin command", () => {
    it("pins a safe server and generates valid lockfile", () => {
      const { exitCode } = runCli([
        "pin",
        "-c",
        join(FIXTURES, "safe-config.json"),
        "-o",
        LOCKFILE,
      ]);
      expect(exitCode).toBe(0);

      const lockfile = JSON.parse(readFileSync(LOCKFILE, "utf-8"));
      expect(lockfile.version).toBe(1);
      expect(lockfile.servers["safe-test"]).toBeDefined();
      expect(lockfile.servers["safe-test"].toolCount).toBe(3);
      expect(lockfile.servers["safe-test"].serverName).toBe("safe-test-server");
      expect(lockfile.servers["safe-test"].serverVersion).toBe("1.0.0");
    });

    it("generates SHA-256 hashes for tool descriptions", () => {
      const lockfile = JSON.parse(readFileSync(LOCKFILE, "utf-8"));
      const tools = lockfile.servers["safe-test"].tools;

      for (const [name, tool] of Object.entries(tools) as any) {
        expect(tool.descriptionHash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(tool.inputSchemaHash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(Array.isArray(tool.capabilities)).toBe(true);
      }
    });

    it("correctly infers read capability", () => {
      const lockfile = JSON.parse(readFileSync(LOCKFILE, "utf-8"));
      const readFile = lockfile.servers["safe-test"].tools["read_file"];
      expect(readFile.capabilities).toContain("read");
    });
  });

  describe("diff command", () => {
    it("reports no drift when server matches lockfile", () => {
      const { exitCode, stdout } = runCli([
        "diff",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "safe-config.json"),
      ]);
      expect(exitCode).toBe(0);
    });

    it("detects drift when server has changed (rug pull)", () => {
      const { exitCode } = runCli([
        "diff",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "drifted-config.json"),
      ]);
      expect(exitCode).toBe(1);
    });

    it("reports description changes as critical", () => {
      const { stdout } = runCli([
        "diff",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "drifted-config.json"),
        "--json",
      ]);
      const diff = extractJson(stdout);
      expect(diff).not.toBeNull();
      expect(diff.drifted).toBe(true);
      const critical = diff.entries.filter(
        (e: any) => e.severity === "critical"
      );
      expect(critical.length).toBeGreaterThan(0);

      const descChanged = critical.find(
        (e: any) => e.type === "description-changed"
      );
      expect(descChanged).toBeDefined();
      expect(descChanged.tool).toBe("read_file");
    });

    it("detects tool removal and addition", () => {
      const { stdout } = runCli([
        "diff",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "drifted-config.json"),
        "--json",
      ]);
      const diff = extractJson(stdout);
      expect(diff).not.toBeNull();
      const removed = diff.entries.find(
        (e: any) => e.type === "tool-removed" && e.tool === "search_files"
      );
      const added = diff.entries.find(
        (e: any) => e.type === "tool-added" && e.tool === "write_file"
      );
      expect(removed).toBeDefined();
      expect(added).toBeDefined();
    });
  });

  describe("scan command", () => {
    it("reports no findings for safe server", () => {
      const { exitCode } = runCli([
        "scan",
        "-c",
        join(FIXTURES, "safe-config.json"),
      ]);
      expect(exitCode).toBe(0);
    });

    it("detects all attack patterns in poisoned server", () => {
      const { stdout } = runCli([
        "scan",
        "-c",
        join(FIXTURES, "poisoned-config.json"),
        "--json",
      ]);
      const scan = extractJson(stdout);
      expect(scan).not.toBeNull();
      expect(scan.findings.length).toBeGreaterThanOrEqual(9);
      expect(scan.summary.critical).toBeGreaterThanOrEqual(4);

      const ruleIds = scan.findings.map((f: any) => f.ruleId);
      expect(ruleIds).toContain("suspicious-description");
      expect(ruleIds).toContain("over-permissioned");
      expect(ruleIds).toContain("command-injection-risk");
      expect(ruleIds).toContain("wildcard-schema");
    });

    it("detects exfiltration directive", () => {
      const { stdout } = runCli([
        "scan",
        "-c",
        join(FIXTURES, "poisoned-config.json"),
        "--json",
      ]);
      const scan = extractJson(stdout);
      expect(scan).not.toBeNull();
      const exfil = scan.findings.find(
        (f: any) =>
          f.ruleId === "suspicious-description" &&
          f.title.includes("exfiltration")
      );
      expect(exfil).toBeDefined();
      expect(exfil.tool).toBe("read_file");
      expect(exfil.severity).toBe("critical");
    });
  });

  describe("ci command", () => {
    it("exits 0 when lockfile matches", () => {
      const { exitCode } = runCli([
        "ci",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "safe-config.json"),
      ]);
      expect(exitCode).toBe(0);
    });

    it("exits 1 when critical drift detected", () => {
      const { exitCode } = runCli([
        "ci",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "drifted-config.json"),
      ]);
      expect(exitCode).toBe(1);
    });

    it("outputs GitHub Actions annotations", () => {
      const { stdout } = runCli([
        "ci",
        "-l",
        LOCKFILE,
        "-c",
        join(FIXTURES, "drifted-config.json"),
      ]);
      expect(stdout).toContain("::error");
    });
  });
});
