/**
 * GoogleTokenService — Google OAuth access token management
 *
 * BR-G-02: Two-stage token refresh strategy:
 *   [Preventive] Check googleAccessTokenExpiresAt before API call
 *   [Fallback]   Refresh on 401/403 response from Google API (retry once)
 *
 * Access tokens expire in 3600 seconds. This service:
 * 1. Checks in-memory cache (warm Lambda reuse)
 * 2. Fetches from Secrets Manager if cache miss
 * 3. Refreshes via refreshToken if expired (5-min buffer)
 * 4. Updates Secrets Manager and in-memory cache after refresh
 */

import { toIsoString } from "@saboru/shared";
import {
  getCachedGoogleAccessToken,
  getGoogleToken,
  saveGoogleToken,
} from "../config/secrets.js";
import type { GoogleTokenSecret } from "../types/google.js";
import { GoogleTokenResponseSchema } from "../types/google.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Buffer in milliseconds before expiry to trigger preventive refresh */
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export class GoogleTokenService {
  /**
   * Get a valid access token for the given user.
   * Performs preventive refresh if token expires within REFRESH_BUFFER_MS.
   *
   * @param userId - Cognito sub
   * @param secretName - Secrets Manager secret name for this user's token
   * @param clientId - Google OAuth client ID
   * @param clientSecret - Google OAuth client secret
   */
  async getValidAccessToken(
    userId: string,
    secretName: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const cached = getCachedGoogleAccessToken(userId);
    const now = Date.now();

    // Use cached token if not expired (with buffer)
    if (cached && cached.expiresAt - now > REFRESH_BUFFER_MS) {
      return cached.accessToken;
    }

    // Fetch from Secrets Manager (also updates in-memory cache)
    const tokenData = await getGoogleToken(userId, secretName);
    const expiresAtMs = new Date(tokenData.expiresAt).getTime();

    if (expiresAtMs - now > REFRESH_BUFFER_MS) {
      return tokenData.accessToken;
    }

    // Token expired or will expire soon — refresh
    return this.refreshAccessToken(
      userId,
      secretName,
      tokenData.refreshToken,
      clientId,
      clientSecret,
    );
  }

  /**
   * Refresh the access token using the refresh token.
   * Saves new token data to Secrets Manager and updates in-memory cache.
   */
  async refreshAccessToken(
    userId: string,
    secretName: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Google token refresh failed: ${response.status} ${response.statusText}`,
      );
    }

    const rawData = await response.json();
    const parseResult = GoogleTokenResponseSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new Error("Google token refresh response validation failed");
    }

    const tokenResp = parseResult.data;
    const expiresAt = new Date(
      Date.now() + tokenResp.expires_in * 1000,
    ).toISOString();

    const newTokenData: GoogleTokenSecret = {
      refreshToken, // refresh_token is not returned on refresh; keep existing
      accessToken: tokenResp.access_token,
      expiresAt,
      scope: tokenResp.scope,
    };

    await saveGoogleToken(userId, secretName, newTokenData);

    return tokenResp.access_token;
  }

  /**
   * Build the Secrets Manager secret name for a user's Google token.
   */
  static buildSecretName(userId: string): string {
    return `saborou/google-token/${userId}`;
  }

  /**
   * Compute access token expiration datetime ISO string from expires_in seconds.
   */
  static computeExpiresAt(expiresInSeconds: number): string {
    return toIsoString(new Date(Date.now() + expiresInSeconds * 1000));
  }
}
