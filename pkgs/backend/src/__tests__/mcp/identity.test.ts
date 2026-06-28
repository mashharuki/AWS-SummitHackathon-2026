import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../../errors.js";
import { extractBearerToken, resolveMcpIdentity } from "../../mcp/identity.js";

describe("extractBearerToken", () => {
  it("extracts bearer token from Authorization header", () => {
    expect(extractBearerToken("Bearer token-123")).toBe("token-123");
  });

  it("rejects missing Authorization header", () => {
    expect(() => extractBearerToken(null)).toThrow(UnauthorizedError);
  });

  it("rejects non-bearer Authorization header", () => {
    expect(() => extractBearerToken("AWS4-HMAC-SHA256 credential")).toThrow(
      "Invalid bearer token",
    );
  });
});

describe("resolveMcpIdentity", () => {
  it("returns verified Cognito identity through injected verifier", async () => {
    const identity = await resolveMcpIdentity("Bearer valid-token", {
      verifier: async (token) => {
        expect(token).toBe("valid-token");
        return {
          sub: "user-123",
          iss: "https://cognito-idp.ap-northeast-1.amazonaws.com/pool",
          aud: "client-123",
        };
      },
    });

    expect(identity).toEqual({
      userId: "user-123",
      issuer: "https://cognito-idp.ap-northeast-1.amazonaws.com/pool",
      audience: "client-123",
    });
  });

  it("rejects invalid issuer or audience reported by verifier", async () => {
    await expect(
      resolveMcpIdentity("Bearer invalid-token", {
        verifier: async () => {
          throw new UnauthorizedError("Invalid token audience");
        },
      }),
    ).rejects.toThrow("Invalid token audience");
  });

  it("rejects IAM-only requests without a bearer token", async () => {
    await expect(resolveMcpIdentity(null)).rejects.toThrow(
      "Missing bearer token",
    );
  });
});
