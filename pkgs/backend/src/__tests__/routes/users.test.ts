/**
 * GET /api/users/me のテスト
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUsersRoute } from "../../routes/users.js";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoUserRepository } from "../../repositories/DynamoUserRepository.js";
import type { User } from "@saboru/shared";

const mockUserId = "cognito-sub-abc123";

/** JWT クレーム付き Lambda イベントを模擬した Hono env */
function makeEnv(claims: Record<string, string> = {}) {
  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: mockUserId, email: "test@example.com", ...claims },
        },
      },
    },
  };
}

function makeApp(repo: DynamoUserRepository) {
  const app = new Hono();
  app.route("/api/users", createUsersRoute(repo));
  app.onError(errorHandler);
  return app;
}

const existingUser: User = {
  PK: `USER#${mockUserId}`,
  SK: "PROFILE",
  cognitoSub: mockUserId,
  email: "test@example.com",
  name: "Test User",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("GET /api/users/me", () => {
  let repo: DynamoUserRepository;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      upsert: vi.fn(),
    } as unknown as DynamoUserRepository;
  });

  it("returns existing user with 200", async () => {
    vi.mocked(repo.findById).mockResolvedValue(existingUser);

    const app = makeApp(repo);
    const res = await app.request(
      "/api/users/me",
      { method: "GET" },
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cognitoSub).toBe(mockUserId);
    expect(repo.findById).toHaveBeenCalledWith(mockUserId);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("creates and returns new user with 201 on first login", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    vi.mocked(repo.upsert).mockResolvedValue({
      ...existingUser,
      name: "test@example.com",
    });

    const app = makeApp(repo);
    const res = await app.request(
      "/api/users/me",
      { method: "GET" },
      makeEnv({ email: "test@example.com" }),
    );

    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitoSub: mockUserId,
        email: "test@example.com",
      }),
    );
  });

  it("returns 401 when userId is missing from JWT", async () => {
    // No JWT context — authMiddleware will throw UnauthorizedError
    const res = await makeApp(repo).request("/api/users/me", { method: "GET" });
    expect(res.status).toBe(401);
  });
});
