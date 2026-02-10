#!/usr/bin/env node
/**
 * mcp-lock benchmark suite
 *
 * Measures performance of pin, diff, scan, and ci commands
 * against controlled test servers with known tool counts.
 *
 * All commands use hardcoded paths (no user input) — safe from injection.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const NODE = process.execPath;
const CLI = "dist/cli.js";
const LOCKFILE = "/tmp/mcp-lock-benchmark.json";

const configs = {
  safe: "tests/fixtures/safe-config.json",
  poisoned: "tests/fixtures/poisoned-config.json",
  multi: "tests/fixtures/multi-config.json",
  drifted: "tests/fixtures/drifted-config.json",
};

function run(args, label) {
  const start = performance.now();
  try {
    execFileSync(NODE, [CLI, ...args], { stdio: "pipe", cwd: process.cwd() });
    const elapsed = performance.now() - start;
    return { label, elapsed, status: "pass", exitCode: 0 };
  } catch (err) {
    const elapsed = performance.now() - start;
    return { label, elapsed, status: err.status === 1 ? "drift/findings" : "error", exitCode: err.status };
  }
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║             mcp-lock Benchmark Suite v0.1.0                 ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("");

const results = [];

// --- Pin benchmarks ---
console.log("  PIN (lockfile generation)");
console.log("  ────────────────────────");

results.push(run(["pin", "-c", configs.safe, "-o", LOCKFILE], "pin: 1 safe server, 3 tools"));
results.push(run(["pin", "-c", configs.poisoned, "-o", "/tmp/mcp-lock-bench-p.json"], "pin: 1 poisoned server, 5 tools"));
results.push(run(["pin", "-c", configs.multi, "-o", "/tmp/mcp-lock-bench-m.json"], "pin: 2 servers, 8 tools"));

for (const r of results.slice(-3)) {
  console.log(`    ${r.status === "pass" ? "✓" : "⚠"} ${r.label}: ${r.elapsed.toFixed(0)}ms`);
}
console.log("");

// --- Diff benchmarks ---
console.log("  DIFF (drift detection)");
console.log("  ──────────────────────");

results.push(run(["diff", "-l", LOCKFILE, "-c", configs.safe], "diff: no drift"));
results.push(run(["diff", "-l", LOCKFILE, "-c", configs.drifted], "diff: drift detected (rug pull)"));

for (const r of results.slice(-2)) {
  console.log(`    ${r.exitCode === 0 ? "✓" : "⚡"} ${r.label}: ${r.elapsed.toFixed(0)}ms (exit ${r.exitCode})`);
}
console.log("");

// --- Scan benchmarks ---
console.log("  SCAN (vulnerability audit)");
console.log("  ──────────────────────────");

results.push(run(["scan", "-c", configs.safe], "scan: safe server (0 findings)"));
results.push(run(["scan", "-c", configs.poisoned], "scan: poisoned server (9 findings)"));
results.push(run(["scan", "-c", configs.multi], "scan: 2 servers mixed (9 findings)"));

for (const r of results.slice(-3)) {
  console.log(`    ${r.exitCode === 0 ? "✓" : "⚡"} ${r.label}: ${r.elapsed.toFixed(0)}ms (exit ${r.exitCode})`);
}
console.log("");

// --- CI benchmarks ---
console.log("  CI (lockfile verification)");
console.log("  ─────────────────────────");

results.push(run(["ci", "-l", LOCKFILE, "-c", configs.safe], "ci: lockfile matches (pass)"));
results.push(run(["ci", "-l", LOCKFILE, "-c", configs.drifted], "ci: drift detected (fail)"));

for (const r of results.slice(-2)) {
  console.log(`    ${r.exitCode === 0 ? "✓" : "⚡"} ${r.label}: ${r.elapsed.toFixed(0)}ms (exit ${r.exitCode})`);
}
console.log("");

// --- Summary ---
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  SUMMARY                                                    ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

const totalMs = results.reduce((s, r) => s + r.elapsed, 0);
const avgMs = totalMs / results.length;
const passed = results.filter((r) => r.exitCode === 0).length;
const drifted = results.filter((r) => r.exitCode === 1).length;
const errored = results.filter((r) => r.exitCode > 1).length;

console.log(`  Total tests:    ${results.length}`);
console.log(`  Passed (0):     ${passed}`);
console.log(`  Drift/Find (1): ${drifted}`);
console.log(`  Errors (2+):    ${errored}`);
console.log(`  Total time:     ${totalMs.toFixed(0)}ms`);
console.log(`  Avg per test:   ${avgMs.toFixed(0)}ms`);
console.log(`  Fastest:        ${Math.min(...results.map((r) => r.elapsed)).toFixed(0)}ms`);
console.log(`  Slowest:        ${Math.max(...results.map((r) => r.elapsed)).toFixed(0)}ms`);
console.log("");
console.log("╚══════════════════════════════════════════════════════════════╝");

// JSON output for CI
const report = {
  timestamp: new Date().toISOString(),
  version: "0.1.0",
  platform: process.platform,
  nodeVersion: process.version,
  results: results.map((r) => ({
    label: r.label,
    elapsed_ms: Math.round(r.elapsed),
    status: r.status,
    exitCode: r.exitCode,
  })),
  summary: {
    total: results.length,
    passed,
    drifted,
    errored,
    total_ms: Math.round(totalMs),
    avg_ms: Math.round(avgMs),
  },
};

writeFileSync("tests/benchmark-results.json", JSON.stringify(report, null, 2) + "\n");
console.log("  Results saved to tests/benchmark-results.json");

// Cleanup
for (const f of [LOCKFILE, "/tmp/mcp-lock-bench-p.json", "/tmp/mcp-lock-bench-m.json"]) {
  if (existsSync(f)) unlinkSync(f);
}
