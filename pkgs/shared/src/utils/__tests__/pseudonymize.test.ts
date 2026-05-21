import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAppError } from "../../errors";
import { pseudonymize } from "../pseudonymize";

describe("pseudonymize", () => {
  const testSalt = "test-salt-for-unit-testing-32chars!!";

  beforeEach(() => {
    process.env["PSEUDONYMIZE_SALT"] = testSalt;
  });

  afterEach(() => {
    delete process.env["PSEUDONYMIZE_SALT"];
  });

  describe("normal operation", () => {
    it("should return a 64-character hex SHA-256 hash", () => {
      const result = pseudonymize("U12345678");
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return the same hash for the same input", () => {
      const result1 = pseudonymize("U12345678");
      const result2 = pseudonymize("U12345678");
      expect(result1).toBe(result2);
    });

    it("should return different hashes for different inputs", () => {
      const result1 = pseudonymize("U12345678");
      const result2 = pseudonymize("U87654321");
      expect(result1).not.toBe(result2);
    });

    it("should return different hashes for different salts", () => {
      const result1 = pseudonymize("U12345678");
      process.env["PSEUDONYMIZE_SALT"] = "different-salt-value-32chars!!!!";
      const result2 = pseudonymize("U12345678");
      expect(result1).not.toBe(result2);
    });

    it("should handle Japanese names", () => {
      const result = pseudonymize("田中太郎");
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should handle empty string", () => {
      const result = pseudonymize("");
      expect(result).toHaveLength(64);
    });

    it("should handle Slack user_id format", () => {
      const result = pseudonymize("USLACK12345");
      expect(result).toHaveLength(64);
    });
  });

  describe("error handling (BR-06)", () => {
    it("should throw AppError when PSEUDONYMIZE_SALT is not set", () => {
      delete process.env["PSEUDONYMIZE_SALT"];
      expect(() => pseudonymize("U12345678")).toThrow();

      try {
        pseudonymize("U12345678");
      } catch (e) {
        expect(isAppError(e)).toBe(true);
        if (isAppError(e)) {
          expect(e.code).toBe("INVALID_INPUT");
          expect(e.statusCode).toBe(500);
        }
      }
    });

    it("should throw AppError when PSEUDONYMIZE_SALT is empty string", () => {
      process.env["PSEUDONYMIZE_SALT"] = "";
      expect(() => pseudonymize("U12345678")).toThrow();

      try {
        pseudonymize("U12345678");
      } catch (e) {
        expect(isAppError(e)).toBe(true);
      }
    });

    it("should throw AppError when PSEUDONYMIZE_SALT is shorter than 16 chars (Phase 1-E-1 fix)", () => {
      process.env["PSEUDONYMIZE_SALT"] = "short";
      expect(() => pseudonymize("U12345678")).toThrow();

      try {
        pseudonymize("U12345678");
      } catch (e) {
        expect(isAppError(e)).toBe(true);
        if (isAppError(e)) {
          expect(e.code).toBe("INVALID_INPUT");
        }
      }
    });
  });

  describe("HMAC collision prevention (Phase 1-E-1 fix)", () => {
    it("should produce different hashes for inputs that would collide with SHA-256 naive concat", () => {
      // 旧実装 SHA256(salt+name) では以下が衝突する:
      // SHA256("abc" + "def") = SHA256("abcd" + "ef") = SHA256("abcdef")
      // HMAC-SHA256 はソルトをキーとして扱うため衝突しない
      process.env["PSEUDONYMIZE_SALT"] = "abc_valid_salt_16";
      const hash1 = pseudonymize("def");

      process.env["PSEUDONYMIZE_SALT"] = "abcd_valid_salt_1";
      const hash2 = pseudonymize("ef");

      expect(hash1).not.toBe(hash2);
    });

    it("should return a non-empty hash for empty string input", () => {
      process.env["PSEUDONYMIZE_SALT"] = testSalt;
      const result = pseudonymize("");
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
