/**
 * Infer tool capabilities from its description and name.
 * Used for lockfile annotations and security scanning.
 */
export function inferCapabilities(
  description: string,
  toolName: string
): string[] {
  const caps: string[] = [];
  const text = (description + " " + toolName).toLowerCase();

  // Filesystem capabilities
  if (/\b(read|get|fetch|load|open|view|list|search|find|glob|cat)\b/.test(text)) {
    caps.push("read");
  }
  if (/\b(write|create|save|put|upload|append|edit|modify|update|patch)\b/.test(text)) {
    caps.push("write");
  }
  if (/\b(delete|remove|unlink|rm|drop|destroy|purge)\b/.test(text)) {
    caps.push("delete");
  }

  // Execution capabilities
  if (/\b(exec|execute|run|spawn|shell|bash|command|eval|invoke)\b/.test(text)) {
    caps.push("execute");
  }

  // Network capabilities
  if (/\b(http|fetch|request|api|url|download|upload|post|webhook|send)\b/.test(text)) {
    caps.push("network");
  }

  // Database capabilities
  if (/\b(query|sql|database|db|insert|select|table|schema)\b/.test(text)) {
    caps.push("database");
  }

  // Credential/secret access
  if (/\b(secret|credential|password|token|key|auth|certificate|private)\b/.test(text)) {
    caps.push("secrets");
  }

  return [...new Set(caps)];
}
