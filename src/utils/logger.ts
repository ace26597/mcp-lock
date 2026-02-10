import chalk from "chalk";

const noColor = !!process.env.NO_COLOR;

function colorize(fn: (s: string) => string, text: string): string {
  return noColor ? text : fn(text);
}

export const log = {
  info: (msg: string) => console.log(colorize(chalk.blue, "ℹ") + " " + msg),
  success: (msg: string) =>
    console.log(colorize(chalk.green, "✓") + " " + msg),
  warn: (msg: string) =>
    console.log(colorize(chalk.yellow, "⚠") + " " + msg),
  error: (msg: string) =>
    console.error(colorize(chalk.red, "✗") + " " + msg),
  drift: (msg: string) =>
    console.log(colorize(chalk.red, "⚡") + " " + msg),
  dim: (msg: string) => console.log(colorize(chalk.dim, msg)),
};
