/**
 * Service connection routes
 *
 * GET    /connections          — List all service connections (US-12)
 * DELETE /connections/:service — Disconnect service (US-12)
 */

import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError } from "../errors.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import type { ServiceType } from "@saboru/shared";
import { SERVICE_TYPE } from "@saboru/shared";

const VALID_SERVICES = Object.values(SERVICE_TYPE) as ServiceType[];

export function createConnectionsRoute(
  connectionRepository: DynamoServiceConnectionRepository,
): Hono<AppEnv> {
  const connections = new Hono<AppEnv>();

  connections.use("*", authMiddleware);

  /** GET /connections — All service connections for user */
  connections.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await connectionRepository.findAllByUserId(userId);
    return c.json({ connections: items });
  });

  /** DELETE /connections/:service — Disconnect a service */
  connections.delete("/:service", async (c) => {
    const userId = c.get("userId");
    const service = c.req.param("service") as ServiceType;

    if (!VALID_SERVICES.includes(service)) {
      return c.json(
        {
          error: {
            code: "INVALID_SERVICE",
            message: `Unknown service: ${service}. Valid services: ${VALID_SERVICES.join(", ")}`,
          },
        },
        400,
      );
    }

    const existing = await connectionRepository.findByUserAndService(
      userId,
      service,
    );
    if (!existing) {
      throw new NotFoundError(`Connection to ${service} not found`);
    }

    await connectionRepository.disconnect(userId, service);
    return c.body(null, 204);
  });

  return connections;
}
