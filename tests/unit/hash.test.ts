import { describe, it, expect } from "vitest";
import { hashValue } from "../../src/utils/hash.js";

describe("hashValue", () => {
  it("produces consistent hashes for strings", () => {
    const hash1 = hashValue("hello world");
    const hash2 = hashValue("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("produces different hashes for different strings", () => {
    const hash1 = hashValue("hello");
    const hash2 = hashValue("world");
    expect(hash1).not.toBe(hash2);
  });

  it("handles objects with deterministic key ordering", () => {
    const hash1 = hashValue({ b: 2, a: 1 });
    const hash2 = hashValue({ a: 1, b: 2 });
    expect(hash1).toBe(hash2);
  });

  it("handles nested objects deterministically", () => {
    const hash1 = hashValue({ z: { b: 2, a: 1 }, y: [3, 2, 1] });
    const hash2 = hashValue({ y: [3, 2, 1], z: { a: 1, b: 2 } });
    expect(hash1).toBe(hash2);
  });

  it("handles null and undefined", () => {
    const hash1 = hashValue(null);
    const hash2 = hashValue(undefined);
    expect(hash1).toBe(hash2);
  });

  it("handles empty objects", () => {
    const hash = hashValue({});
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("handles arrays", () => {
    const hash1 = hashValue([1, 2, 3]);
    const hash2 = hashValue([1, 2, 3]);
    expect(hash1).toBe(hash2);

    const hash3 = hashValue([3, 2, 1]);
    expect(hash1).not.toBe(hash3);
  });
});
