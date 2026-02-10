#!/usr/bin/env node
/**
 * A safe MCP server for testing — standard tools with clean descriptions.
 * Used by mcp-lock test suite to verify pin/diff/scan workflow.
 */
import { createInterface } from "node:readline";

const SERVER_INFO = {
  name: "safe-test-server",
  version: "1.0.0",
};

const TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path and return it as text",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "list_directory",
    description: "List files and subdirectories in a given directory path",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a glob pattern in a directory",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern to match" },
        directory: { type: "string", description: "Root directory for search" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
  },
];

// JSON-RPC message handling over stdio
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  processBuffer();
});

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (buffer.length < bodyEnd) break;

    const body = buffer.slice(bodyStart, bodyEnd);
    buffer = buffer.slice(bodyEnd);

    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch {}
  }
}

function handleMessage(msg) {
  if (msg.method === "initialize") {
    sendResponse(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  } else if (msg.method === "notifications/initialized") {
    // No response needed for notifications
  } else if (msg.method === "tools/list") {
    sendResponse(msg.id, { tools: TOOLS });
  }
}

function sendResponse(id, result) {
  const response = JSON.stringify({ jsonrpc: "2.0", id, result });
  const header = `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n`;
  process.stdout.write(header + response);
}
