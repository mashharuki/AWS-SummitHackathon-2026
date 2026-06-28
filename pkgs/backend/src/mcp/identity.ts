import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors.js";
import type { McpIdentity } from "./types.js";

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});
const MCP_API_KEY_SECRET = "saborou/mcp-api-key";

export type VerifiedJwtClaims = {
  sub: string;
  iss: string;
  aud: string;
};

export type JwtVerifier = (token: string) => Promise<VerifiedJwtClaims>;

export type McpIdentityResolverOptions = {
  verifier?: JwtVerifier;
};

export function extractBearerToken(authorization: string | null): string {
  if (!authorization) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new UnauthorizedError("Invalid bearer token");
  }

  return match[1];
}

export async function resolveMcpIdentity(
  authorization: string | null,
  options: McpIdentityResolverOptions = {},
): Promise<McpIdentity> {
  const token = extractBearerToken(authorization);

  // テスト等でカスタム verifier が注入された場合は常にそちらを使う
  if (options.verifier) {
    const claims = await options.verifier(token);
    return { userId: claims.sub, issuer: claims.iss, audience: claims.aud };
  }

  // JWT は "." を2つ以上含む → Cognito JWT として検証
  if (token.split(".").length >= 3) {
    const claims = await verifyCognitoJwt(token);
    return { userId: claims.sub, issuer: claims.iss, audience: claims.aud };
  }

  // それ以外 → 静的 API キーとして検証
  return verifyMcpApiKey(token);
}

async function verifyMcpApiKey(token: string): Promise<McpIdentity> {
  let secret: { apiKey: string; userId: string };
  try {
    const res = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: MCP_API_KEY_SECRET }),
    );
    secret = JSON.parse(res.SecretString ?? "{}") as {
      apiKey: string;
      userId: string;
    };
  } catch {
    throw new UnauthorizedError("API key verification unavailable");
  }

  if (token !== secret.apiKey) {
    throw new UnauthorizedError("Invalid API key");
  }

  return {
    userId: secret.userId,
    issuer: "saborou/mcp-api-key",
    audience: "mcp",
  };
}

export async function verifyCognitoJwt(
  token: string,
): Promise<VerifiedJwtClaims> {
  const region = process.env.AWS_REGION ?? "ap-northeast-1";
  const userPoolId = env.COGNITO_USER_POOL_ID;
  const clientId = env.COGNITO_CLIENT_ID;
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return validateCognitoClaims(payload, issuer, clientId);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Invalid Cognito token");
  }
}

function validateCognitoClaims(
  payload: JWTPayload,
  issuer: string,
  clientId: string,
): VerifiedJwtClaims {
  if (!payload.sub) {
    throw new UnauthorizedError("Missing subject claim");
  }

  const audience = normalizeAudience(payload.aud);
  const clientClaim =
    typeof payload.client_id === "string" ? payload.client_id : "";
  const effectiveAudience = audience.includes(clientId)
    ? clientId
    : clientClaim;

  if (payload.iss !== issuer) {
    throw new UnauthorizedError("Invalid token issuer");
  }

  if (effectiveAudience !== clientId) {
    throw new UnauthorizedError("Invalid token audience");
  }

  return {
    sub: payload.sub,
    iss: issuer,
    aud: effectiveAudience,
  };
}

function normalizeAudience(audience: JWTPayload["aud"]): string[] {
  if (typeof audience === "string") {
    return [audience];
  }

  return audience ?? [];
}
