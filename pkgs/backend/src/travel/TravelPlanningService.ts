import type { IBedrockClient } from "@saboru/agent";
import {
  buildFixtureActivities,
  buildFixtureFlights,
  buildFixtureHotels,
  normalizeIata,
} from "./fixtures.js";
import {
  TravelPlanRequestSchema,
  TravelPlanResponseSchema,
  type TravelActivitiesByDay,
  type TravelFlightOption,
  type TravelHotelOption,
  type TravelPlanRequest,
  type TravelPlanResponse,
} from "./schemas.js";
import { TravelpayoutsClient } from "./TravelpayoutsClient.js";

const MODEL_ID = "jp.anthropic.claude-haiku-4-5-20251001-v1:0";
const TRAVEL_PLANNER_TOOL_NAME = "plan_trip_options";

const TRAVEL_PLANNER_TOOL = {
  toolSpec: {
    name: TRAVEL_PLANNER_TOOL_NAME,
    description:
      "Select concise travel hotel and activity options from safe, non-secret inputs.",
    inputSchema: {
      json: {
        type: "object",
        additionalProperties: false,
        required: ["hotels", "activitiesByDay", "assumptions"],
        properties: {
          hotels: { type: "array" },
          activitiesByDay: { type: "array" },
          assumptions: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

type PlannerOutput = {
  hotels: TravelHotelOption[];
  activitiesByDay: TravelActivitiesByDay[];
  assumptions: string[];
};

export type TravelPlanningServiceOptions = {
  travelpayoutsClient?: Pick<
    TravelpayoutsClient,
    "getFlightPricesForDates" | "createPartnerLinks" | "hasCredentials"
  >;
  bedrockClient?: IBedrockClient;
};

export class TravelPlanningService {
  private readonly travelpayoutsClient?: TravelPlanningServiceOptions["travelpayoutsClient"];

  constructor(private readonly options: TravelPlanningServiceOptions = {}) {
    this.travelpayoutsClient = options.travelpayoutsClient;
  }

  async plan(rawInput: unknown): Promise<TravelPlanResponse> {
    const request = TravelPlanRequestSchema.parse(rawInput);
    const missingFields = this.findMissingFields(request);

    if (missingFields.length > 0) {
      const nextQuestion = this.buildClarificationQuestion(missingFields);
      return TravelPlanResponseSchema.parse({
        status: "needs_clarification",
        message: nextQuestion,
        missingFields,
        sourceMode: "fixture",
        plan: {
          summary: "旅行プラン作成に必要な条件が不足しています。",
          assumptions: [
            "出発地は未指定の場合Tokyoとして扱います。",
            "人数、通貨、興味はデフォルト値で補完できます。",
          ],
          flights: [],
          hotels: [],
          activitiesByDay: [],
          nextQuestion,
        },
      });
    }

    const completeRequest = request as TravelPlanRequest & {
      destination: string;
      departureDate: string;
      returnDate: string;
    };

    const fixtureFlights = buildFixtureFlights(completeRequest);
    const fixtureHotels = buildFixtureHotels(completeRequest);
    const fixtureActivities = buildFixtureActivities(completeRequest);

    let flights = fixtureFlights;
    let flightSource: "live" | "fixture" = "fixture";
    try {
      if (this.travelpayoutsClient) {
        flights = await this.travelpayoutsClient.getFlightPricesForDates({
          originIata: normalizeIata(completeRequest.origin),
          destinationIata: normalizeIata(completeRequest.destination),
          departureDate: completeRequest.departureDate,
          returnDate: completeRequest.returnDate,
          currency: completeRequest.currency,
          travelers: completeRequest.travelers,
        });
        flightSource = "live";
      }
    } catch {
      flights = fixtureFlights;
      flightSource = "fixture";
    }

    const plannerOutput = await this.planHotelsAndActivities(
      completeRequest,
      fixtureHotels,
      fixtureActivities,
    );

    const { hotels, activitiesByDay, linkSource } =
      await this.attachPartnerLinks(
        completeRequest,
        plannerOutput.hotels,
        plannerOutput.activitiesByDay,
      );

    const sourceMode = this.resolveSourceMode([flightSource, linkSource]);
    const summary = this.buildSummary(completeRequest, flights, hotels);
    const message = `${completeRequest.destination}旅行は、航空券${flights[0]?.price.amount.toLocaleString("ja-JP")}${completeRequest.currency}前後から、${hotels[0]?.area ?? "中心部"}滞在で組めます。初日は移動を軽めにして、食事と街歩きから始めるのがおすすめです。`;

    return TravelPlanResponseSchema.parse({
      status: "planned",
      message,
      missingFields: [],
      sourceMode,
      plan: {
        summary,
        assumptions: [
          ...plannerOutput.assumptions,
          "フライト価格はキャッシュ系データまたはデモ用fixtureに基づく候補です。",
          "予約導線はPartner Links APIが使えない場合、元の提携サービスURLを表示します。",
        ].slice(0, 8),
        flights,
        hotels,
        activitiesByDay,
        nextQuestion: null,
      },
    });
  }

  private findMissingFields(
    request: TravelPlanRequest,
  ): Array<"destination" | "departureDate" | "returnDate"> {
    const missing: Array<"destination" | "departureDate" | "returnDate"> = [];
    if (!request.destination) missing.push("destination");
    if (!request.departureDate) missing.push("departureDate");
    if (!request.returnDate) missing.push("returnDate");
    return missing;
  }

  private buildClarificationQuestion(
    missingFields: Array<"destination" | "departureDate" | "returnDate">,
  ): string {
    const labels = missingFields.map((field) => {
      switch (field) {
        case "destination":
          return "行き先";
        case "departureDate":
          return "出発日";
        case "returnDate":
          return "帰国日";
      }
    });
    return `旅行プランを作るために、${labels.join("、")}を教えてください。`;
  }

  private async planHotelsAndActivities(
    request: TravelPlanRequest & {
      destination: string;
      departureDate: string;
      returnDate: string;
    },
    fallbackHotels: TravelHotelOption[],
    fallbackActivities: TravelActivitiesByDay[],
  ): Promise<PlannerOutput> {
    if (!this.options.bedrockClient) {
      return {
        hotels: fallbackHotels,
        activitiesByDay: fallbackActivities,
        assumptions: [
          "AI選定が使えないため、デモ用の安定候補を利用しています。",
        ],
      };
    }

    try {
      const response = await this.options.bedrockClient.converse({
        modelId: MODEL_ID,
        system: [
          {
            text: [
              "You are SABOROU's travel planning assistant.",
              "Return only tool output. Never include credentials, API tokens, Authorization headers, marker, or trs.",
              "Keep Japanese reasons short and voice-friendly.",
            ].join("\n"),
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: JSON.stringify({
                  destination: request.destination,
                  departureDate: request.departureDate,
                  returnDate: request.returnDate,
                  travelers: request.travelers,
                  budgetPerPerson: request.budgetPerPerson,
                  interests: request.interests,
                  hotelPreference: request.hotelPreference,
                  fallbackHotels,
                  fallbackActivities,
                }),
              },
            ],
          },
        ],
        toolConfig: {
          tools: [TRAVEL_PLANNER_TOOL as never],
          toolChoice: { tool: { name: TRAVEL_PLANNER_TOOL_NAME } },
        },
        inferenceConfig: { maxTokens: 1800, temperature: 0 },
      });

      const toolUse = response.output?.message?.content?.find(
        (block) => block.toolUse?.name === TRAVEL_PLANNER_TOOL_NAME,
      );
      const input = toolUse?.toolUse?.input as
        | Partial<PlannerOutput>
        | undefined;
      const hotels = input?.hotels ?? fallbackHotels;
      const activitiesByDay = input?.activitiesByDay ?? fallbackActivities;
      const assumptions = input?.assumptions ?? [
        "AI選定が不完全だったため、安定候補を併用しています。",
      ];

      return {
        hotels,
        activitiesByDay,
        assumptions,
      };
    } catch {
      return {
        hotels: fallbackHotels,
        activitiesByDay: fallbackActivities,
        assumptions: [
          "AI選定に失敗したため、デモ用の安定候補を利用しています。",
        ],
      };
    }
  }

  private async attachPartnerLinks(
    request: TravelPlanRequest & { destination: string },
    hotels: TravelHotelOption[],
    activitiesByDay: TravelActivitiesByDay[],
  ): Promise<{
    hotels: TravelHotelOption[];
    activitiesByDay: TravelActivitiesByDay[];
    linkSource: "live" | "fixture";
  }> {
    const urls = [
      ...hotels.map((hotel) => hotel.bookingUrl).filter(isPresent),
      ...activitiesByDay.flatMap((day) =>
        day.items.map((item) => item.bookingUrl).filter(isPresent),
      ),
    ];

    if (!this.travelpayoutsClient || urls.length === 0) {
      return { hotels, activitiesByDay, linkSource: "fixture" };
    }

    const links = await this.travelpayoutsClient.createPartnerLinks(
      urls,
      `travel-plan-${request.destination
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)}`,
    );
    if (links.every((link) => !link)) {
      return { hotels, activitiesByDay, linkSource: "fixture" };
    }

    let cursor = 0;
    const linkedHotels = hotels.map((hotel) => {
      if (!hotel.bookingUrl) return hotel;
      const linked = links[cursor++] ?? hotel.bookingUrl;
      return { ...hotel, bookingUrl: linked };
    });
    const linkedActivities = activitiesByDay.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        if (!item.bookingUrl) return item;
        const linked = links[cursor++] ?? item.bookingUrl;
        return { ...item, bookingUrl: linked };
      }),
    }));

    return {
      hotels: linkedHotels,
      activitiesByDay: linkedActivities,
      linkSource: links.some(Boolean) ? "live" : "fixture",
    };
  }

  private resolveSourceMode(sources: Array<"live" | "fixture">) {
    if (sources.every((source) => source === "live")) return "live";
    if (sources.every((source) => source === "fixture")) return "fixture";
    return "mixed";
  }

  private buildSummary(
    request: TravelPlanRequest & {
      destination: string;
      departureDate: string;
      returnDate: string;
    },
    flights: TravelFlightOption[],
    hotels: TravelHotelOption[],
  ): string {
    const firstFlight = flights[0];
    const firstHotel = hotels[0];
    const budgetText = request.budgetPerPerson
      ? `1人${request.budgetPerPerson.toLocaleString("ja-JP")}${request.currency}の予算`
      : "予算未指定";
    return `${request.departureDate}から${request.returnDate}までの${request.destination}旅行です。${budgetText}で、${firstFlight?.title ?? "航空券候補"}と${firstHotel?.name ?? "中心部ホテル"}を軸に、${request.interests.join("、")}を楽しむ短期プランにします。`;
  }
}

function isPresent(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}
