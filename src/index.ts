// Public API — for programmatic usage
export { generateLockfile } from "./core/lockfile.js";
export { computeDiff } from "./core/differ.js";
export { runScan } from "./core/scanner.js";
export { discoverConfig } from "./parsers/config-discovery.js";
export type { Lockfile, LockfileServer, LockfileTool } from "./core/types.js";
export type { DiffResult, DiffEntry } from "./core/differ.js";
export type { ScanResult, ScanFinding } from "./core/scanner.js";
export type { MCPConfig, MCPServerConfig } from "./parsers/types.js";
