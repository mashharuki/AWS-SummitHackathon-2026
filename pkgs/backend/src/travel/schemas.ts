import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must use YYYY-MM-DD format",
});

const safeText = z.string().trim().min(1).max(120);
const safeUrl = z.string().url().max(1000).nullable();

export const TravelPlanRequestSchema = z
  .object({
    origin: safeText.default("Tokyo"),
    destination: safeText.optional(),
    departureDate: dateSchema.optional(),
    returnDate: dateSchema.optional(),
    travelers: z.number().int().min(1).max(8).default(1),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .default("JPY"),
    budgetPerPerson: z.number().int().min(0).max(10_000_000).optional(),
    interests: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(8)
      .default(["sightseeing", "food", "culture"]),
    flightPreference: z
      .enum(["cheapest", "fastest", "balanced"])
      .default("balanced"),
    hotelPreference: z
      .enum(["budget", "standard", "premium"])
      .default("standard"),
    language: z.enum(["ja", "en"]).default("ja"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.departureDate &&
      value.returnDate &&
      value.departureDate > value.returnDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnDate"],
        message: "returnDate must be on or after departureDate",
      });
    }
  });

export const TravelPriceSchema = z
  .object({
    amount: z.number().int().min(0),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();

export const TravelFlightOptionSchema = z
  .object({
    rank: z.number().int().min(1).max(10),
    title: z.string().min(1).max(180),
    price: TravelPriceSchema,
    reason: z.string().min(1).max(400),
    bookingUrl: safeUrl,
  })
  .strict();

export const TravelHotelOptionSchema = z
  .object({
    rank: z.number().int().min(1).max(10),
    name: z.string().min(1).max(160),
    area: z.string().min(1).max(160),
    reason: z.string().min(1).max(400),
    bookingUrl: safeUrl,
  })
  .strict();

export const TravelActivityItemSchema = z
  .object({
    title: z.string().min(1).max(180),
    timeOfDay: z.enum(["morning", "afternoon", "evening"]),
    reason: z.string().min(1).max(400),
    bookingUrl: safeUrl,
  })
  .strict();

export const TravelActivitiesByDaySchema = z
  .object({
    day: z.number().int().min(1).max(31),
    date: dateSchema,
    items: z.array(TravelActivityItemSchema).min(1).max(4),
  })
  .strict();

export const TravelPlanSchema = z
  .object({
    summary: z.string().min(1).max(800),
    assumptions: z.array(z.string().min(1).max(300)).max(8),
    flights: z.array(TravelFlightOptionSchema).max(5),
    hotels: z.array(TravelHotelOptionSchema).max(5),
    activitiesByDay: z.array(TravelActivitiesByDaySchema).max(31),
    nextQuestion: z.string().min(1).max(300).nullable(),
  })
  .strict();

export const TravelPlanResponseSchema = z
  .object({
    status: z.enum(["planned", "needs_clarification"]),
    message: z.string().min(1).max(1000),
    missingFields: z.array(
      z.enum(["destination", "departureDate", "returnDate"]),
    ),
    sourceMode: z.enum(["live", "fixture", "mixed"]),
    plan: TravelPlanSchema,
  })
  .strict();

export type TravelPlanRequest = z.infer<typeof TravelPlanRequestSchema>;
export type TravelPlanResponse = z.infer<typeof TravelPlanResponseSchema>;
export type TravelFlightOption = z.infer<typeof TravelFlightOptionSchema>;
export type TravelHotelOption = z.infer<typeof TravelHotelOptionSchema>;
export type TravelActivitiesByDay = z.infer<typeof TravelActivitiesByDaySchema>;
