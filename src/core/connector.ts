import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { MCPServerConfig } from "../parsers/types.js";
import type { LiveServerInfo, LiveTool } from "./types.js";

const DANGEROUS_ENV_VARS = new Set([
  "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH", "NODE_OPTIONS", "NODE_EXTRA_CA_CERTS",
  "PYTHONSTARTUP", "PYTHONPATH", "RUBYOPT",
]);

function sanitizeEnv(userEnv: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(userEnv)) {
    if (DANGEROUS_ENV_VARS.has(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * Connect to an MCP server and retrieve its tool definitions.
 * Uses the official MCP SDK for all transports (stdio, SSE, Streamable HTTP).
 */
export async function connectAndListTools(
  serverName: string,
  config: MCPServerConfig,
  timeoutMs: number
): Promise<LiveServerInfo> {
  const transport = config.transport || "stdio";

  if (transport === "stdio") {
    return connectStdio(serverName, config, timeoutMs);
  } else {
    return connectHttp(serverName, config, timeoutMs);
  }
}

async function connectStdio(
  _serverName: string,
  config: MCPServerConfig,
  timeoutMs: number
): Promise<LiveServerInfo> {
  // Build env: start with process.env (filtering undefined), then merge user config
  const baseEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) baseEnv[k] = v;
  }
  const env = { ...baseEnv, ...sanitizeEnv(config.env || {}) };

  const transport = new StdioClientTransport({
    command: config.command!,
    args: config.args,
    env,
    stderr: "pipe",
  });

  return connectWithClient(transport, timeoutMs);
}

async function connectHttp(
  _serverName: string,
  config: MCPServerConfig,
  timeoutMs: number
): Promise<LiveServerInfo> {
  const url = new URL(config.url!);

  // If transport is explicitly specified, use it directly
  if (config.transport === "sse") {
    return connectWithClient(new SSEClientTransport(url), timeoutMs);
  }

  if (config.transport === "streamable-http") {
    return connectWithClient(new StreamableHTTPClientTransport(url), timeoutMs);
  }

  // Auto-detect: try Streamable HTTP first, fall back to legacy SSE
  try {
    return await connectWithClient(new StreamableHTTPClientTransport(url), timeoutMs);
  } catch {
    return await connectWithClient(new SSEClientTransport(url), timeoutMs);
  }
}

/**
 * Create an MCP Client, connect via the given transport, list tools, then close.
 */
async function connectWithClient(
  transport: Transport,
  timeoutMs: number
): Promise<LiveServerInfo> {
  const client = new Client(
    { name: "mcp-lock", version: "0.1.0" },
    { capabilities: {} }
  );

  try {
    await withTimeout(client.connect(transport), timeoutMs);

    const toolsResult = await withTimeout(client.listTools(), timeoutMs);

    const serverVersion = client.getServerVersion();
    const tools: LiveTool[] = (toolsResult.tools || []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));

    return {
      protocolVersion: (transport as any).protocolVersion,
      serverName: serverVersion?.name,
      serverVersion: serverVersion?.version,
      tools,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Connection timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
}
