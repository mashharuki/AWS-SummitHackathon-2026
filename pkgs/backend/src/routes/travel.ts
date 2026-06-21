import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import {
  TravelPlanAndPostToSlackRequestSchema,
  TravelPlanRequestSchema,
} from "../travel/schemas.js";
import type { TravelPlanSlackPostService } from "../travel/TravelPlanSlackPostService.js";
import type { TravelPlanningService } from "../travel/TravelPlanningService.js";

export function createTravelRoute(
  service: Pick<TravelPlanningService, "plan"> &
    Pick<TravelPlanSlackPostService, "planAndPostToSlack">,
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

  travel.post(
    "/plan-and-post-to-slack",
    zValidator("json", TravelPlanAndPostToSlackRequestSchema),
    async (c) => {
      const request = c.req.valid("json");
      const response = await service.planAndPostToSlack({
        userId: c.get("userId"),
        request,
      });
      return c.json(response);
    },
  );

  return travel;
}
