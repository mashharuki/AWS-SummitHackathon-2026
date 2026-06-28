import type {
  TravelActivitiesByDay,
  TravelFlightOption,
  TravelHotelOption,
  TravelPlanRequest,
} from "./schemas.js";

const IATA_BY_CITY: Record<string, string> = {
  tokyo: "TYO",
  東京: "TYO",
  narita: "NRT",
  haneda: "HND",
  paris: "PAR",
  パリ: "PAR",
  london: "LON",
  "new york": "NYC",
  seoul: "SEL",
  ソウル: "SEL",
  taipei: "TPE",
  台北: "TPE",
  singapore: "SIN",
  シンガポール: "SIN",
};

export function normalizeIata(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return (
    IATA_BY_CITY[trimmed.toLowerCase()] ?? trimmed.slice(0, 3).toUpperCase()
  );
}

export function buildFixtureFlights(
  request: TravelPlanRequest,
): TravelFlightOption[] {
  const origin = normalizeIata(request.origin);
  const destination = normalizeIata(request.destination ?? "Paris");
  const base =
    request.currency === "JPY"
      ? request.destination?.toLowerCase().includes("paris") ||
        request.destination?.includes("パリ")
        ? 118_000
        : 82_000
      : 780;

  return [
    {
      rank: 1,
      title: `${origin}から${destination}のバランス重視フライト`,
      price: { amount: base * request.travelers, currency: request.currency },
      reason:
        "価格と移動時間のバランスがよく、初日の観光時間を残しやすい候補です。",
      bookingUrl: null,
    },
    {
      rank: 2,
      title: `${origin}から${destination}の価格重視フライト`,
      price: {
        amount: Math.round(base * 0.88) * request.travelers,
        currency: request.currency,
      },
      reason: "乗継または時間帯の条件を少し許容して、総額を抑える候補です。",
      bookingUrl: null,
    },
    {
      rank: 3,
      title: `${origin}から${destination}の快適性重視フライト`,
      price: {
        amount: Math.round(base * 1.22) * request.travelers,
        currency: request.currency,
      },
      reason:
        "移動負荷を抑え、到着後に予定を入れやすい時間帯を優先した候補です。",
      bookingUrl: null,
    },
  ];
}

export function buildFixtureHotels(
  request: TravelPlanRequest,
): TravelHotelOption[] {
  const destination = request.destination ?? "Paris";
  const isParis =
    destination.toLowerCase().includes("paris") || destination.includes("パリ");
  const cityLabel = isParis ? "Paris" : destination;
  const area = isParis ? "Opéra / Louvre" : "Central area";

  return [
    {
      rank: 1,
      name: isParis ? "Hotel Louvre Saint-Honoré" : `${cityLabel} Central Stay`,
      area,
      reason:
        "主要スポットへの移動が短く、初めての滞在でも予定を組みやすい立地です。",
      bookingUrl: `https://www.aviasales.com/hotels?destination=${encodeURIComponent(cityLabel)}`,
    },
    {
      rank: 2,
      name: isParis
        ? "Hôtel des Arts Montmartre"
        : `${cityLabel} Culture Hotel`,
      area: isParis ? "Montmartre" : "Old town / cultural district",
      reason: "食事や街歩きの満足度を上げやすく、夜の移動も短くできます。",
      bookingUrl: `https://www.aviasales.com/hotels?destination=${encodeURIComponent(cityLabel)}&sub=standard`,
    },
    {
      rank: 3,
      name: isParis
        ? "Citadines Saint-Germain"
        : `${cityLabel} Apartment Hotel`,
      area: isParis ? "Saint-Germain" : "Riverside / quiet district",
      reason: "連泊向きで荷物管理がしやすく、朝夕をゆっくり過ごせます。",
      bookingUrl: `https://www.aviasales.com/hotels?destination=${encodeURIComponent(cityLabel)}&sub=apartment`,
    },
  ];
}

export function buildFixtureActivities(
  request: TravelPlanRequest,
): TravelActivitiesByDay[] {
  const destination = request.destination ?? "Paris";
  const start = request.departureDate ?? "2026-07-10";
  const days = Math.max(
    1,
    Math.min(5, tripDays(start, request.returnDate ?? start)),
  );
  const isParis =
    destination.toLowerCase().includes("paris") || destination.includes("パリ");

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const day = index + 1;
    if (isParis) {
      return {
        day,
        date,
        items: parisActivities(day),
      };
    }
    return {
      day,
      date,
      items: [
        {
          title: `${destination}の中心エリア散策`,
          timeOfDay: "morning",
          reason: "到着後でも負担が少なく、街の距離感をつかめます。",
          bookingUrl: `https://www.viator.com/searchResults/all?text=${encodeURIComponent(destination)}`,
        },
        {
          title: `${destination}のローカルフード体験`,
          timeOfDay: "evening",
          reason:
            "食事の満足度を上げつつ、翌日の予定相談もしやすい時間帯です。",
          bookingUrl: `https://www.tiqets.com/en/search?q=${encodeURIComponent(destination)}`,
        },
      ],
    };
  });
}

function parisActivities(day: number): TravelActivitiesByDay["items"] {
  const patterns: TravelActivitiesByDay["items"][] = [
    [
      {
        title: "ルーヴル美術館とセーヌ川沿い散策",
        timeOfDay: "afternoon",
        reason: "到着日に無理なくパリらしさを感じられる定番ルートです。",
        bookingUrl: "https://www.tiqets.com/en/louvre-museum-tickets-l124891/",
      },
      {
        title: "ビストロで軽めのフレンチ",
        timeOfDay: "evening",
        reason: "初日は移動疲れを考え、ホテル周辺で完結しやすい食事にします。",
        bookingUrl: "https://www.viator.com/Paris/d479-ttd",
      },
    ],
    [
      {
        title: "オルセー美術館",
        timeOfDay: "morning",
        reason: "アート関心に合い、午後の街歩きとも組み合わせやすいです。",
        bookingUrl: "https://www.tiqets.com/en/musee-dorsay-tickets-l141868/",
      },
      {
        title: "サンジェルマンでカフェ巡り",
        timeOfDay: "afternoon",
        reason: "食と文化を同じエリアで楽しめ、移動時間を抑えられます。",
        bookingUrl:
          "https://www.viator.com/Paris-tours/Food-Wine-and-Nightlife/d479-g6",
      },
    ],
    [
      {
        title: "モンマルトル歴史散策",
        timeOfDay: "morning",
        reason: "歴史と街並みを短時間で味わえる、写真映えするルートです。",
        bookingUrl: "https://www.wegotrip.com/paris-d3/",
      },
      {
        title: "エッフェル塔周辺の夜景",
        timeOfDay: "evening",
        reason: "旅の締めに印象が残りやすく、音声デモでも伝えやすい予定です。",
        bookingUrl: "https://www.tiqets.com/en/eiffel-tower-tickets-l145531/",
      },
    ],
  ];

  return patterns[(day - 1) % patterns.length];
}

function tripDays(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 1;
  }
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}

function addDays(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
