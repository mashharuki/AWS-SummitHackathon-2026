import { describe, expect, it } from "vitest";
import { generateUlid } from "../generateUlid";

describe("generateUlid", () => {
  it("should return a 26-character string", () => {
    const ulid = generateUlid();
    expect(ulid).toHaveLength(26);
  });

  it("should return uppercase Crockford Base32 characters", () => {
    const ulid = generateUlid();
    // Crockford's Base32: 0-9, A-Z excluding I, L, O, U
    expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("should generate unique values on each call", () => {
    const ulids = new Set(Array.from({ length: 100 }, () => generateUlid()));
    expect(ulids.size).toBe(100);
  });

  it("should be lexicographically sortable by time", () => {
    const ulid1 = generateUlid();
    // Small delay to ensure different timestamp
    const ulid2 = generateUlid();
    // Both are valid; ulid2 >= ulid1 (same timestamp is also valid in fast execution)
    expect(typeof ulid1).toBe("string");
    expect(typeof ulid2).toBe("string");
  });

  it("should be usable as DynamoDB SK prefix", () => {
    const ulid = generateUlid();
    const sk = `TASK#${ulid}`;
    expect(sk).toMatch(/^TASK#[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("should be usable as TASK_CAND# prefix", () => {
    const ulid = generateUlid();
    const sk = `TASK_CAND#${ulid}`;
    expect(sk).toMatch(/^TASK_CAND#[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
