/**
 * Tests for Secrets Manager module-scope cache (config/secrets.ts)
 *
 * Tests cover:
 * - Cache MISS: first call fetches from Secrets Manager and caches
 * - Cache HIT: second call returns cached value without fetching again
 * - fetchSecret error: throws when SecretString is missing
 * - _resetSecretsCache: clears cache so next call fetches again
 *
 * Implementation note:
 * vi.mock() is hoisted by Vitest before any test code runs, so we cannot
 * reference test-local variables inside the factory. Instead we use
 * vi.hoisted() to create shared mutable mocks that both the factory and tests
 * can reference, and vi.resetModules() to reload the module between tests so
 * the module-level cache is fresh each time.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create hoisted mutable mock so factory and test body share the same reference
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  // Must be a class (function constructor) so `new SecretsManagerClient()` works
  SecretsManagerClient: class {
    send = sendMock;
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));

const SIGNING_SECRET = "my-signing-secret";
const CLIENT_SECRET = "my-client-secret";

describe("getSlackSigningSecret", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("fetches from Secrets Manager on cache MISS", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    const result = await getSlackSigningSecret("arn:test:signing");
    expect(result).toBe(SIGNING_SECRET);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("returns cached value on cache HIT (no second Secrets Manager call)", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    await getSlackSigningSecret("arn:test:signing");
    await getSlackSigningSecret("arn:test:signing");
    // Only fetched once despite two calls (cache HIT on second)
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("throws when SecretString is missing from Secrets Manager response", async () => {
    sendMock.mockResolvedValue({}); // no SecretString

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    await expect(getSlackSigningSecret("arn:test:signing")).rejects.toThrow(
      "has no SecretString",
    );
  });
});

describe("getSlackClientSecret", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("fetches and caches client secret", async () => {
    sendMock.mockResolvedValue({ SecretString: CLIENT_SECRET });

    const { getSlackClientSecret } = await import("../../config/secrets.js");
    const result = await getSlackClientSecret("arn:test:client");
    expect(result).toBe(CLIENT_SECRET);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("returns cached value on cache HIT for client secret", async () => {
    sendMock.mockResolvedValue({ SecretString: CLIENT_SECRET });

    const { getSlackClientSecret } = await import("../../config/secrets.js");
    await getSlackClientSecret("arn:test:client");
    await getSlackClientSecret("arn:test:client");
    expect(sendMock).toHaveBeenCalledOnce();
  });
});

describe("_resetSecretsCache", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("clears the signing secret cache so next call fetches again", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret, _resetSecretsCache } = await import(
      "../../config/secrets.js"
    );
    await getSlackSigningSecret("arn:test:signing"); // fetch #1
    _resetSecretsCache(); // clear cache
    await getSlackSigningSecret("arn:test:signing"); // fetch #2
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
