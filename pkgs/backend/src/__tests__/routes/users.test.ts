/**
 * GET /api/users/me のテスト
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUsersRoute } from "../../routes/users.js";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoHonneRepository } from "../../repositories/DynamoHonneRepository.js";
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

const mockHonneRepo = {
  findAllByUserId: vi.fn().mockResolvedValue([]),
} as unknown as DynamoHonneRepository;

function makeApp(repo: DynamoUserRepository) {
  const app = new Hono();
  app.route("/api/users", createUsersRoute(repo, mockHonneRepo));
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

  it("self-heals UUID-shaped name using id_token name claim", async () => {
    // 過去に access_token 経由で name が UUID 保存されていたユーザー
    const uuidNamedUser: User = {
      ...existingUser,
      name: mockUserId, // findById は UUID 形式の name を返す想定だが…
    };
    // mockUserId は UUID 形式ではないため、UUID 形式の sub に差し替える
    const uuidSub = "12345678-1234-1234-1234-1234567890ab";
    const env = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: uuidSub,
              email: "real@example.com",
              name: "Real Name",
            },
          },
        },
      },
    };
    vi.mocked(repo.findById).mockResolvedValue({
      ...uuidNamedUser,
      PK: `USER#${uuidSub}`,
      cognitoSub: uuidSub,
      name: uuidSub, // UUID 形式の name（フォールバック保存済み）
    });
    vi.mocked(repo.upsert).mockImplementation(async (u) => ({
      PK: `USER#${u.cognitoSub}`,
      SK: "PROFILE",
      ...u,
    }));

    const app = makeApp(repo);
    const res = await app.request("/api/users/me", { method: "GET" }, env);

    expect(res.status).toBe(200);
    // name は UUID から修復される。email は既存値（健全）が優先保持される。
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Real Name", email: "test@example.com" }),
    );
  });

  it("self-heals empty email using id_token email claim", async () => {
    // 過去に access_token 経由で email が空保存されていたユーザー
    vi.mocked(repo.findById).mockResolvedValue({
      ...existingUser,
      email: "", // 空の email（access_token には email クレームがないため）
    });
    vi.mocked(repo.upsert).mockImplementation(async (u) => ({
      PK: `USER#${u.cognitoSub}`,
      SK: "PROFILE",
      ...u,
    }));

    const app = makeApp(repo);
    const res = await app.request(
      "/api/users/me",
      { method: "GET" },
      makeEnv({ email: "recovered@example.com" }),
    );

    expect(res.status).toBe(200);
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "recovered@example.com" }),
    );
    // name は健全なのでそのまま保持される
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test User" }),
    );
  });

  it("does not upsert when both name and email are already healthy", async () => {
    vi.mocked(repo.findById).mockResolvedValue(existingUser);

    const app = makeApp(repo);
    const res = await app.request(
      "/api/users/me",
      { method: "GET" },
      makeEnv(),
    );

    expect(res.status).toBe(200);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
