// Normalize text passed to ElevenLabs so frequently occurring dynamic fragments
// are read naturally without changing JSON keys such as taskId/channelId/threadTs.
const TERM_MAP: [RegExp, string][] = [
  [/\bAWS Summit Japan 2026\b/g, "エーダブリューエス サミット ジャパン 2026"],
  [/\bAI-DLC\b/g, "エーアイ・ディーエルシー"],
  [/\bCloudFront\b/g, "クラウドフロント"],
  [/\bCloudWatch\b/g, "クラウドウォッチ"],
  [/\bDynamoDB\b/g, "ダイナモディービー"],
  [/\bAgentCore\b/g, "エージェントコア"],
  [/\bElevenLabs\b/g, "イレブンラボ"],
  [/\bTypeScript\b/g, "タイプスクリプト"],
  [/\bGitHub\b/g, "ギットハブ"],
  [/\bHackathon\b/g, "ハッカソン"],
  [/\bSABOROU\b/g, "サボロー"],
  [/\bSummit\b/g, "サミット"],
  [/\bLambda\b/g, "ラムダ"],
  [/\bBedrock\b/g, "ベッドロック"],
  [/\bChrome\b/g, "クローム"],
  [/\bVitest\b/g, "バイテスト"],
  [/\bBiome\b/g, "バイオーム"],
  [/\bSlack\b/g, "スラック"],
  [/\bHono\b/g, "ホノ"],
  [/\bGmail\b/gi, "ジーメール"],
  [/\bAWS\b/g, "エーダブリューエス"],
  [/\bMCP\b/g, "エムシーピー"],
  [/\bAPI\b/g, "エーピーアイ"],
  [/\bPWA\b/g, "ピーダブリューエー"],
  [/\bE2E\b/g, "エンドツーエンド"],
  [/\bURL\b/g, "ユーアールエル"],
  [/\bUX\b/g, "ユーエックス"],
  [/\bUI\b/g, "ユーアイ"],
  [/\bAI\b/g, "エーアイ"],
  [/\bPM\b/g, "ピーエム"],
  [/\bPR\b/g, "ピーアール"],
  [/\bIQ\b/g, "アイキュー"],
  [/\bID\b/g, "アイディー"],
  [/\bS3\b/g, "エススリー"],
  [/\bP0\b/g, "ピーゼロ"],
  [/\bP1\b/g, "ピーイチ"],
  [/\bP2\b/g, "ピーツー"],
];

const STATUS_MAP: [RegExp, string][] = [
  [/\bactive\b/gi, "進行中"],
  [/\bcompleted\b/gi, "完了"],
  [/\bpending\b/gi, "保留中"],
  [/\bopen\b/gi, "未対応"],
  [/\bclosed\b/gi, "対応済み"],
  [/\bhigh\b/gi, "高"],
  [/\bmedium\b/gi, "中"],
  [/\blow\b/gi, "低"],
];

export function normalizeForTts(text: string): string {
  const parsed = parseJson(text);
  if (parsed.ok) {
    return JSON.stringify(normalizeJsonValue(parsed.value), null, 2);
  }

  return normalizeText(text);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function normalizeJsonValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && shouldSummarizeValueForKey(key)) {
      return summarizeMachineValue(key, value);
    }
    return normalizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        normalizeJsonValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function shouldSummarizeValueForKey(key: string): boolean {
  return (
    key === "id" ||
    key.endsWith("Id") ||
    key.endsWith("ID") ||
    key === "threadTs"
  );
}

function summarizeMachineValue(key: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return "リンク";
  if (key === "threadTs" || /^\d{10}\.\d{6}$/.test(value)) {
    return "スレッドのタイムスタンプ";
  }
  if (key === "channelId") return "チャンネルアイディー";
  return "アイディー";
}

function normalizeText(input: string): string {
  const withoutUrls = input.replace(/https?:\/\/[^\s"'<>）)]+/gi, "リンク");
  const withDates = withoutUrls.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (_, year: string, month: string, day: string) =>
      `${year}年${Number(month)}月${Number(day)}日`,
  );
  const withTimes = withDates.replace(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/g,
    (_, hour: string, minute: string) => `${Number(hour)}時${minute}分`,
  );
  const withSlackTs = withTimes.replace(
    /\b\d{10}\.\d{6}\b/g,
    "スレッドのタイムスタンプ",
  );
  const withCounters = withSlackTs.replace(
    /(?<!時)(?<!時\d)(\d+)(個|件|人|分|時間)/g,
    (_, rawNumber: string, counter: string) =>
      normalizeCounter(Number(rawNumber), counter),
  );
  const withIds = withCounters
    .replace(/\bC[A-Z0-9]{8,}\b/g, "チャンネルアイディー")
    .replace(/\b[A-Za-z0-9_-]{16,}\b/g, "アイディー");

  return applyMap(applyMap(withIds, STATUS_MAP), TERM_MAP);
}

function applyMap(text: string, map: [RegExp, string][]): string {
  return map.reduce((current, [pattern, reading]) => {
    return current.replace(pattern, reading);
  }, text);
}

function normalizeCounter(value: number, counter: string): string {
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    return `${value}${counter}`;
  }

  if (counter === "個") {
    const special: Record<number, string> = {
      1: "いっこ",
      6: "ろっこ",
      8: "はっこ",
      10: "じゅっこ",
      100: "ひゃっこ",
    };
    return special[value] ?? `${numberToJapanese(value)}こ`;
  }

  if (counter === "件") {
    const special: Record<number, string> = {
      1: "いっけん",
      10: "じゅっけん",
      100: "ひゃっけん",
    };
    return special[value] ?? `${numberToJapanese(value)}けん`;
  }

  if (counter === "人") {
    const special: Record<number, string> = {
      1: "ひとり",
      2: "ふたり",
    };
    return special[value] ?? `${numberToJapanese(value)}にん`;
  }

  if (counter === "分") {
    const special: Record<number, string> = {
      1: "いっぷん",
      6: "ろっぷん",
      8: "はっぷん",
      10: "じゅっぷん",
    };
    return special[value] ?? `${numberToJapanese(value)}ふん`;
  }

  if (counter === "時間") {
    return `${numberToJapanese(value)}じかん`;
  }

  return `${value}${counter}`;
}

function numberToJapanese(value: number): string {
  const digit: Record<number, string> = {
    0: "ぜろ",
    1: "いち",
    2: "に",
    3: "さん",
    4: "よん",
    5: "ご",
    6: "ろく",
    7: "なな",
    8: "はち",
    9: "きゅう",
  };

  if (value < 10) return digit[value];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${tens === 1 ? "" : digit[tens]}じゅう${ones ? digit[ones] : ""}`;
  }

  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const hundredPrefix =
    hundreds === 1 ? "ひゃく" : `${digit[hundreds]}ひゃく`;
  return `${hundredPrefix}${rest ? numberToJapanese(rest) : ""}`;
}
