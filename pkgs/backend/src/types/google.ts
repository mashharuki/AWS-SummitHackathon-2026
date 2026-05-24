/**
 * Google API type definitions and Zod schemas
 *
 * BR-G-01: Google OAuth token exchange response
 * BR-G-02: Google token secret storage schema (JSON format in Secrets Manager)
 */

import { z } from "zod";

/**
 * Google OAuth token exchange response schema
 * POST https://oauth2.googleapis.com/token
 */
export const GoogleTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string(),
  token_type: z.string(),
});

export type GoogleTokenResponse = z.infer<typeof GoogleTokenResponseSchema>;

/**
 * Google token secret storage schema (JSON stored in Secrets Manager)
 *
 * Unlike Slack (plain-text bot token), Google requires multiple values:
 * - refreshToken: long-lived token for obtaining new access tokens
 * - accessToken: short-lived token (1h) for API calls
 * - expiresAt: access token expiration datetime (ISO 8601)
 * - scope: space-separated granted scopes
 */
export const GoogleTokenSecretSchema = z.object({
  refreshToken: z.string(),
  accessToken: z.string(),
  expiresAt: z.string(),
  scope: z.string(),
});

export type GoogleTokenSecret = z.infer<typeof GoogleTokenSecretSchema>;
