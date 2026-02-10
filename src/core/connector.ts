import type { MCPServerConfig } from "../parsers/types.js";
import type { LiveServerInfo, LiveTool } from "./types.js";

/**
 * Connect to an MCP server and retrieve its tool definitions.
 *
 * Uses the MCP protocol: initialize → tools/list
 *
 * For stdio servers: spawns the process, communicates via JSON-RPC over stdin/stdout.
 * For HTTP servers: sends HTTP requests to the server URL.
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
  const { spawn } = await import("node:child_process");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`Connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const env = { ...process.env, ...(config.env || {}) };
    const proc = spawn(config.command!, config.args || [], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let stdout = "";

    proc.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      // Try to parse complete JSON-RPC messages
      tryProcessMessages(stdout, proc, timeout, resolve, reject);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    // Send initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "mcp-lock",
          version: "0.1.0",
        },
      },
    };

    proc.stdin!.write(
      `Content-Length: ${Buffer.byteLength(JSON.stringify(initRequest))}\r\n\r\n${JSON.stringify(initRequest)}`
    );
  });
}

/**
 * Process JSON-RPC messages from stdout buffer.
 * Handles the initialize → initialized → tools/list flow.
 */
function tryProcessMessages(
  buffer: string,
  proc: ReturnType<typeof import("node:child_process").spawn>,
  timeout: ReturnType<typeof setTimeout>,
  resolve: (info: LiveServerInfo) => void,
  reject: (err: Error) => void
): void {
  // Parse Content-Length delimited messages
  const messages = extractJsonRpcMessages(buffer);

  for (const msg of messages) {
    try {
      const parsed = JSON.parse(msg);

      // Initialize response (id: 1)
      if (parsed.id === 1 && parsed.result) {
        const serverInfo = parsed.result.serverInfo || {};

        // Send initialized notification
        const notif = { jsonrpc: "2.0", method: "notifications/initialized" };
        proc.stdin!.write(
          `Content-Length: ${Buffer.byteLength(JSON.stringify(notif))}\r\n\r\n${JSON.stringify(notif)}`
        );

        // Send tools/list request
        const toolsReq = {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        };
        proc.stdin!.write(
          `Content-Length: ${Buffer.byteLength(JSON.stringify(toolsReq))}\r\n\r\n${JSON.stringify(toolsReq)}`
        );

        // Store server info for later
        (proc as any).__serverInfo = {
          protocolVersion: parsed.result.protocolVersion,
          serverName: serverInfo.name,
          serverVersion: serverInfo.version,
        };
      }

      // Tools/list response (id: 2)
      if (parsed.id === 2 && parsed.result) {
        clearTimeout(timeout);
        const tools: LiveTool[] = (parsed.result.tools || []).map(
          (t: any) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })
        );

        const info = (proc as any).__serverInfo || {};
        proc.kill();

        resolve({
          ...info,
          tools,
        });
      }
    } catch {
      // Incomplete message, wait for more data
    }
  }
}

function extractJsonRpcMessages(buffer: string): string[] {
  const messages: string[] = [];
  let remaining = buffer;

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = remaining.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (remaining.length < bodyEnd) break;

    messages.push(remaining.slice(bodyStart, bodyEnd));
    remaining = remaining.slice(bodyEnd);
  }

  return messages;
}

async function connectHttp(
  _serverName: string,
  config: MCPServerConfig,
  timeoutMs: number
): Promise<LiveServerInfo> {
  const url = config.url!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Send initialize
    const initResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-lock", version: "0.1.0" },
        },
      }),
      signal: controller.signal,
    });

    const initResult = (await initResp.json()) as any;
    const serverInfo = initResult.result?.serverInfo || {};

    // Send tools/list
    const toolsResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      signal: controller.signal,
    });

    const toolsResult = (await toolsResp.json()) as any;
    const tools: LiveTool[] = (toolsResult.result?.tools || []).map(
      (t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })
    );

    return {
      protocolVersion: initResult.result?.protocolVersion,
      serverName: serverInfo.name,
      serverVersion: serverInfo.version,
      tools,
    };
  } finally {
    clearTimeout(timeout);
  }
}
