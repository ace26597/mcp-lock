/**
 * Infer tool capabilities from its description, name, and optionally inputSchema.
 * Used for lockfile annotations and security scanning.
 */
export function inferCapabilities(
  description: string,
  toolName: string,
  inputSchema?: Record<string, unknown>
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

  // Execution capabilities (single-word + multi-word patterns)
  if (
    /\b(exec|execute|run|spawn|shell|bash|command|eval|invoke)\b/.test(text) ||
    /\b(run python|run code|eval js|shell script|code execution|subprocess)\b/.test(text)
  ) {
    caps.push("execute");
  }

  // Network capabilities (single-word + multi-word patterns)
  if (
    /\b(http|fetch|request|api|url|download|upload|post|webhook|send)\b/.test(text) ||
    /\b(http request|web request|api call)\b/.test(text)
  ) {
    caps.push("network");
  }

  // Database capabilities (single-word + multi-word patterns)
  if (
    /\b(query|sql|database|db|insert|select|table|schema)\b/.test(text) ||
    /\b(prepare statement|database connection)\b/.test(text)
  ) {
    caps.push("database");
  }

  // Credential/secret access
  if (/\b(secret|credential|password|token|key|auth|certificate|private)\b/.test(text)) {
    caps.push("secrets");
  }

  // Analyze inputSchema property names for additional capability hints
  if (inputSchema) {
    const propNames = extractPropertyNames(inputSchema);

    for (const prop of propNames) {
      if (/^(command|shell|script|code)$/.test(prop)) {
        caps.push("execute");
      }
      if (/^(url|endpoint|uri|webhook)$/.test(prop)) {
        caps.push("network");
      }
      if (/^(query|sql|statement|table)$/.test(prop)) {
        caps.push("database");
      }
      if (/^(path|file|directory|filename)$/.test(prop)) {
        caps.push("read");
        // Also infer write if description hints at writing
        if (/\b(write|create|save|put|upload|append|edit|modify|update|patch)\b/.test(text)) {
          caps.push("write");
        }
      }
      if (/^(password|token|secret|key|credential)$/.test(prop)) {
        caps.push("secrets");
      }
    }
  }

  return [...new Set(caps)];
}

/**
 * Extract property names from a JSON Schema inputSchema object.
 */
function extractPropertyNames(schema: Record<string, unknown>): string[] {
  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    return Object.keys(properties as Record<string, unknown>).map((k) => k.toLowerCase());
  }
  return [];
}
