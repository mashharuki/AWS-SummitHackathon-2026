// Maps English abbreviations and acronyms to katakana for TTS readability.
// Applied to MCP JSON-RPC responses before sending to ElevenLabs.
// Using \b word boundaries so camelCase keys (taskId, userId) are not affected.
const ABBR_MAP: [RegExp, string][] = [
  [/\bAI-DLC\b/g, "エーアイ・ディーエルシー"],
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
  [/\bP0\b/g, "ピーゼロ"],
  [/\bP1\b/g, "ピーイチ"],
  [/\bP2\b/g, "ピーツー"],
  [/\bGmail\b/gi, "ジーメール"],
];

export function normalizeForTts(jsonString: string): string {
  return ABBR_MAP.reduce((s, [pattern, reading]) => s.replace(pattern, reading), jsonString);
}
