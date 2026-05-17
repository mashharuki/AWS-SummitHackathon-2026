/**
 * Hono application type definitions for U-04 API
 *
 * HonoVariables: typed context variables set by middleware
 * AppEnv: Hono generics for type-safe c.get() / c.set()
 */

/** Context variables propagated by authMiddleware */
export type HonoVariables = {
  userId: string;
};

/** Hono app env generics */
export type AppEnv = {
  Variables: HonoVariables;
};
