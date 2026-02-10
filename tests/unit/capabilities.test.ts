import { describe, it, expect } from "vitest";
import { inferCapabilities } from "../../src/core/capabilities.js";

describe("inferCapabilities", () => {
  it("detects read capability", () => {
    const caps = inferCapabilities("Read a file from the filesystem", "read_file");
    expect(caps).toContain("read");
  });

  it("detects write capability", () => {
    const caps = inferCapabilities("Write content to a file", "write_file");
    expect(caps).toContain("write");
  });

  it("detects execute capability", () => {
    const caps = inferCapabilities("Execute a shell command", "run_command");
    expect(caps).toContain("execute");
  });

  it("detects network capability", () => {
    const caps = inferCapabilities("Fetch data from an HTTP API", "fetch_url");
    expect(caps).toContain("network");
  });

  it("detects database capability", () => {
    const caps = inferCapabilities("Run a SQL query against the database", "query_db");
    expect(caps).toContain("database");
  });

  it("detects secrets capability", () => {
    const caps = inferCapabilities("Retrieve API key from vault", "get_secret");
    expect(caps).toContain("secrets");
  });

  it("detects delete capability", () => {
    const caps = inferCapabilities("Remove a file from disk", "delete_file");
    expect(caps).toContain("delete");
  });

  it("detects multiple capabilities", () => {
    const caps = inferCapabilities(
      "Execute a command and write the output to a file",
      "run_and_save"
    );
    expect(caps).toContain("execute");
    expect(caps).toContain("write");
  });

  it("returns empty array for benign descriptions", () => {
    const caps = inferCapabilities("Calculate the sum of two numbers", "add");
    expect(caps).toHaveLength(0);
  });

  // inputSchema-based inference tests
  describe("inputSchema-based inference", () => {
    it("detects execute from schema property named 'command'", () => {
      const caps = inferCapabilities("Perform an action", "do_thing", {
        type: "object",
        properties: { command: { type: "string" } },
      });
      expect(caps).toContain("execute");
    });

    it("detects network from schema property named 'url'", () => {
      const caps = inferCapabilities("Retrieve data", "get_data", {
        type: "object",
        properties: { url: { type: "string" } },
      });
      expect(caps).toContain("network");
    });

    it("detects database from schema property named 'query'", () => {
      const caps = inferCapabilities("Look up information", "lookup", {
        type: "object",
        properties: { query: { type: "string" } },
      });
      expect(caps).toContain("database");
    });

    it("detects read from schema property named 'path'", () => {
      const caps = inferCapabilities("Process something", "process", {
        type: "object",
        properties: { path: { type: "string" } },
      });
      expect(caps).toContain("read");
    });

    it("detects read+write from schema 'file' property with write description", () => {
      const caps = inferCapabilities("Save the output", "save_output", {
        type: "object",
        properties: { file: { type: "string" } },
      });
      expect(caps).toContain("read");
      expect(caps).toContain("write");
    });

    it("detects secrets from schema property named 'token'", () => {
      const caps = inferCapabilities("Authenticate", "auth", {
        type: "object",
        properties: { token: { type: "string" } },
      });
      expect(caps).toContain("secrets");
    });

    it("does not infer from schema when properties are absent", () => {
      const caps = inferCapabilities("Calculate the sum of two numbers", "add", {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
      });
      expect(caps).toHaveLength(0);
    });
  });

  // Multi-word pattern matching tests
  describe("multi-word pattern matching", () => {
    it("detects execute from 'run python'", () => {
      const caps = inferCapabilities("Run python to analyze data", "analyze");
      expect(caps).toContain("execute");
    });

    it("detects execute from 'code execution'", () => {
      const caps = inferCapabilities("Supports code execution in sandbox", "sandbox_tool");
      expect(caps).toContain("execute");
    });

    it("detects execute from 'subprocess'", () => {
      const caps = inferCapabilities("Launch a subprocess", "launcher");
      expect(caps).toContain("execute");
    });

    it("detects network from 'http request'", () => {
      const caps = inferCapabilities("Make an http request to the service", "call_service");
      expect(caps).toContain("network");
    });

    it("detects network from 'api call'", () => {
      const caps = inferCapabilities("Perform an api call", "remote_op");
      expect(caps).toContain("network");
    });

    it("detects database from 'prepare statement'", () => {
      const caps = inferCapabilities("Prepare statement for execution", "stmt_tool");
      expect(caps).toContain("database");
    });

    it("detects database from 'database connection'", () => {
      const caps = inferCapabilities("Open a database connection", "connect_db");
      expect(caps).toContain("database");
    });
  });

  // Combined description + schema inference tests
  describe("combined description + schema inference", () => {
    it("merges capabilities from description and schema without duplicates", () => {
      const caps = inferCapabilities("Execute a command", "runner", {
        type: "object",
        properties: { command: { type: "string" }, url: { type: "string" } },
      });
      expect(caps).toContain("execute");
      expect(caps).toContain("network");
      // execute should not be duplicated
      expect(caps.filter((c) => c === "execute")).toHaveLength(1);
    });

    it("schema adds capabilities that description misses", () => {
      const caps = inferCapabilities("Perform the operation", "do_op", {
        type: "object",
        properties: {
          script: { type: "string" },
          endpoint: { type: "string" },
          credential: { type: "string" },
        },
      });
      expect(caps).toContain("execute");
      expect(caps).toContain("network");
      expect(caps).toContain("secrets");
    });
  });
});
