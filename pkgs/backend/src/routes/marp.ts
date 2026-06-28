import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  MarpCreateSlidesAndPostToSlackRequestSchema,
  MarpCreateSlidesRequestSchema,
} from "../marp/schemas.js";
import type { MarpSlideSlackPostService } from "../marp/MarpSlideSlackPostService.js";
import type { MarpSlideService } from "../marp/MarpSlideService.js";
import type { AppEnv } from "../types.js";

export function createMarpRoute(
  service: Pick<MarpSlideService, "createSlides"> &
    Pick<MarpSlideSlackPostService, "createSlidesAndPostToSlack">,
) {
  const marp = new Hono<AppEnv>();

  marp.use("*", authMiddleware);

  marp.post(
    "/create-slides",
    zValidator("json", MarpCreateSlidesRequestSchema),
    async (c) => {
      const input = c.req.valid("json");
      const response = await service.createSlides(input);
      return c.json(response);
    },
  );

  marp.post(
    "/create-slides-and-post-to-slack",
    zValidator("json", MarpCreateSlidesAndPostToSlackRequestSchema),
    async (c) => {
      const request = c.req.valid("json");
      const response = await service.createSlidesAndPostToSlack({
        userId: c.get("userId"),
        request,
      });
      return c.json(response);
    },
  );

  return marp;
}
