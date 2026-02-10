#!/usr/bin/env node
/**
 * A safe MCP server for testing — standard tools with clean descriptions.
 * Used by mcp-lock test suite to verify pin/diff/scan workflow.
 *
 * Uses newline-delimited JSON (matching the MCP SDK stdio transport).
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

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    handleMessage(msg);
  } catch {}
});

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
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
