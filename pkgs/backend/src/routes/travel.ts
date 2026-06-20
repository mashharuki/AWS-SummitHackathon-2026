import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import { TravelPlanRequestSchema } from "../travel/schemas.js";
import type { TravelPlanningService } from "../travel/TravelPlanningService.js";

export function createTravelRoute(
  service: Pick<TravelPlanningService, "plan">,
) {
  const travel = new Hono<AppEnv>();

  travel.use("*", authMiddleware);

  travel.post(
    "/plan",
    zValidator("json", TravelPlanRequestSchema),
    async (c) => {
      const input = c.req.valid("json");
      const response = await service.plan(input);
      return c.json(response);
    },
  );

  return travel;
}
