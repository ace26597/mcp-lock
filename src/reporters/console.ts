// Console reporter utilities — shared formatting for CLI output.
// Individual commands handle their own output; this module provides reusable helpers.

import chalk from "chalk";

const noColor = !!process.env.NO_COLOR;

export function severityBadge(severity: string): string {
  if (noColor) return severity.toUpperCase().padEnd(8);

  const badges: Record<string, string> = {
    critical: chalk.bgRed.white.bold(" CRITICAL "),
    high: chalk.bgRed.white(" HIGH "),
    medium: chalk.bgYellow.black(" MEDIUM "),
    low: chalk.bgBlue.white(" LOW "),
    warning: chalk.bgYellow.black(" WARNING "),
    info: chalk.bgCyan.white(" INFO "),
  };

  return badges[severity] || severity.toUpperCase();
}

export function serverLabel(name: string): string {
  return noColor ? name : chalk.bold(name);
}

export function toolLabel(name: string): string {
  return noColor ? name : chalk.cyan(name);
}

export function hashSnippet(hash: string): string {
  // Show first 12 chars of hash for readability
  const short = hash.replace(/^sha256:/, "").slice(0, 12) + "...";
  return noColor ? short : chalk.dim(short);
}
