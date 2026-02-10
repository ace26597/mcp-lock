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
});
