import type { TravelPlanResponse } from "./schemas.js";

const MAX_SLACK_TEXT_LENGTH = 4000;
const MAX_PREVIEW_LENGTH = 220;

export function formatTravelPlanForSlack(response: TravelPlanResponse): string {
  const plan = response.plan;
  const sections = [
    `*${escapeSlackText("SABOROU旅行プラン")}*`,
    "",
    `*概要*\n${escapeSlackText(plan.summary)}`,
    formatFlights(plan.flights.slice(0, 3)),
    formatHotels(plan.hotels.slice(0, 3)),
    formatActivities(plan.activitiesByDay.slice(0, 5)),
    formatAssumptions(plan.assumptions.slice(0, 5)),
  ].filter((section) => section.length > 0);

  return truncateSlackText(sections.join("\n\n"), MAX_SLACK_TEXT_LENGTH);
}

export function previewSlackText(text: string): string {
  return truncateSlackText(text.replace(/\s+/g, " "), MAX_PREVIEW_LENGTH);
}

export function escapeSlackText(value: string): string {
  return redactSensitiveText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/api[-_ ]?token[^\s,;)]*/gi, "[redacted]")
    .replace(/marker[^\s,;)]*/gi, "[redacted]")
    .replace(/trs[^\s,;)]*/gi, "[redacted]")
    .replace(/Authorization[^\n]*/gi, "[redacted]")
    .replace(/Bearer\s+[^\s]+/gi, "[redacted]");
}

function formatFlights(flights: TravelPlanResponse["plan"]["flights"]): string {
  if (flights.length === 0) return "";

  const lines = flights.map((flight) => {
    const price = `${flight.price.amount.toLocaleString("ja-JP")}${flight.price.currency}`;
    return [
      `• ${escapeSlackText(flight.title)} (${escapeSlackText(price)})`,
      `  ${escapeSlackText(flight.reason)}`,
      formatBookingLink(flight.bookingUrl),
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `*フライト候補*\n${lines.join("\n")}`;
}

function formatHotels(hotels: TravelPlanResponse["plan"]["hotels"]): string {
  if (hotels.length === 0) return "";

  const lines = hotels.map((hotel) =>
    [
      `• ${escapeSlackText(hotel.name)} / ${escapeSlackText(hotel.area)}`,
      `  ${escapeSlackText(hotel.reason)}`,
      formatBookingLink(hotel.bookingUrl),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return `*ホテル候補*\n${lines.join("\n")}`;
}

function formatActivities(
  days: TravelPlanResponse["plan"]["activitiesByDay"],
): string {
  if (days.length === 0) return "";

  const daySections = days.map((day) => {
    const items = day.items.slice(0, 3).map((item) =>
      [
        `• ${escapeSlackText(item.timeOfDay)}: ${escapeSlackText(item.title)}`,
        `  ${escapeSlackText(item.reason)}`,
        formatBookingLink(item.bookingUrl),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return `_${day.day}日目 ${escapeSlackText(day.date)}_\n${items.join("\n")}`;
  });

  return `*日別アクティビティ*\n${daySections.join("\n")}`;
}

function formatAssumptions(assumptions: string[]): string {
  if (assumptions.length === 0) return "";

  return `*前提/注意点*\n${assumptions
    .map((assumption) => `• ${escapeSlackText(assumption)}`)
    .join("\n")}`;
}

function formatBookingLink(url: string | null): string {
  if (!url) return "";
  return `  <${sanitizeSlackLinkUrl(url)}|予約リンク>`;
}

function sanitizeSlackLinkUrl(url: string): string {
  return url
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/\|/g, "%7C")
    .replace(/\s/g, "%20");
}

function truncateSlackText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 20)).trimEnd()}\n\n...省略しました`;
}
