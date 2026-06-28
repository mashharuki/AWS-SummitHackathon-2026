/**
 * mcpFallback.ts — ElevenLabs MCP フォールバックモード管理
 *
 * U-V3-04: ElevenLabs Dashboard でのリモート MCP 登録と、
 * 拡張機能 clientTools フォールバックの状態を管理するモジュール。
 *
 * - FallbackMode: 現在の MCP 接続モードを示す 5 値の型
 * - SafeConfigView: JWT・API キー等のシークレットを含まないアローリスト設定ビュー
 * - getMcpFallbackMode(): 環境変数から現在のモードを判定する
 * - getSafeConfigView(): セキュアな設定ビューを返す（シークレット非露出）
 * - getMcpToolsBaseUrl(): MCP tools ベース URL を返す（null-safe）
 *
 * セキュリティ設計原則（NFR-U-V3-04-S1）:
 * - JWT・API キー・Slack トークン・Google トークンは一切このモジュールから露出しない
 * - getSafeConfigView() はアローリストフィールドのみを返す
 * - endpointHost は URL 全体ではなくホスト部のみを公開する
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/**
 * MCP 接続フォールバックモード（5値）
 *
 * - remote_mcp_primary: ElevenLabs Dashboard 登録済み・検証済み（U-V3-05 で設定）
 * - remote_mcp_unverified: Dashboard 登録設定あり・未検証（VITE_MCP_TOOLS_BASE_URL 設定済み）
 * - client_tools_fallback: 拡張機能 clientTools フォールバック（Hono API 経由）
 * - hono_direct_fallback: Hono API 直接フォールバック（clientTools 外）
 * - unconfigured: 設定なし
 */
export type FallbackMode =
  | "remote_mcp_primary"
  | "remote_mcp_unverified"
  | "client_tools_fallback"
  | "hono_direct_fallback"
  | "unconfigured";

/**
 * セーフ診断コード（6コード）
 * フォールバックの失敗原因を特定するための診断コード。
 * シークレットや内部パスを含まないセーフな識別子。
 */
export type SafeDiagnosticCode =
  | "MCP_REGISTRATION_MISSING"
  | "MCP_TRANSPORT_UNVERIFIED"
  | "MCP_PRIMARY_UNAVAILABLE"
  | "FALLBACK_AUTH_REQUIRED"
  | "FALLBACK_API_UNAVAILABLE"
  | "MCP_SCHEMA_MISMATCH";

/**
 * セーフ設定ビュー（アローリストのみ）
 *
 * JWT・API キー・Slack トークン・Google トークンを一切含まない。
 * ElevenLabs Dashboard 登録状態と診断情報のみを公開する。
 */
export interface SafeConfigView {
  /** MCP トランスポート種別 */
  transport: "streamable_http" | "sse" | null;
  /** エンドポイントのホスト部のみ（URL 全体は露出しない） */
  endpointHost: string | null;
  /** フォールバックが有効かどうか */
  fallbackEnabled: boolean;
  /** MCP 設定の検証状態 */
  verificationState: "verified" | "unverified" | "not_attempted";
  /** 診断コード（問題がない場合は null） */
  diagnosticCode: SafeDiagnosticCode | null;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * URL からホスト部のみを抽出する（URL 全体を露出しない）
 * @param url - 完全な URL 文字列
 * @returns ホスト部（例: "abc123.execute-api.ap-northeast-1.amazonaws.com"）または null
 */
function getEndpointHost(url: string | null | undefined): string | null {
  if (!url || url === "undefined" || url === "null") return null;
  try {
    return new URL(url).host;
  } catch {
    // URL パースエラー時は null を返す（URL 全体を露出しない）
    return null;
  }
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * VITE_MCP_TOOLS_BASE_URL 環境変数から MCP ツールのベース URL を返す
 * @returns MCP tools ベース URL または null
 */
export function getMcpToolsBaseUrl(): string | null {
  const v = import.meta.env.VITE_MCP_TOOLS_BASE_URL;
  if (!v || v === "undefined" || v === "null") return null;
  return v;
}

/**
 * 現在の MCP フォールバックモードを返す
 *
 * 判定ロジック:
 * - VITE_MCP_TOOLS_BASE_URL が設定済み → remote_mcp_unverified
 *   （検証済みフラグ remote_mcp_primary は U-V3-05 で設定する）
 * - 未設定 → client_tools_fallback
 *   （Hono API を clientTools として ElevenLabs エージェントに登録）
 *
 * @returns 現在の FallbackMode
 */
export function getMcpFallbackMode(): FallbackMode {
  if (getMcpToolsBaseUrl() !== null) {
    return "remote_mcp_unverified";
  }
  return "client_tools_fallback";
}

/**
 * セーフ設定ビューを返す
 *
 * シークレット非露出の原則に従い、アローリストフィールドのみを返す。
 * JWT・API キー・Slack/Google トークンは一切含まれない。
 *
 * @returns SafeConfigView インスタンス
 */
export function getSafeConfigView(): SafeConfigView {
  const mcpBaseUrl = getMcpToolsBaseUrl();
  const mode = getMcpFallbackMode();

  // トランスポート種別の判定（URL 設定済みの場合は streamable_http）
  const transport: SafeConfigView["transport"] =
    mcpBaseUrl !== null ? "streamable_http" : null;

  // ホスト部のみを公開（URL 全体を露出しない）
  const endpointHost = getEndpointHost(mcpBaseUrl);

  // フォールバックは常に有効（Hono API が常にフォールバックとして機能）
  const fallbackEnabled = true;

  // 検証状態（remote_mcp_primary のみ verified — U-V3-05 でのみ設定）
  const verificationState: SafeConfigView["verificationState"] =
    mode === "remote_mcp_primary"
      ? "verified"
      : mcpBaseUrl !== null
        ? "unverified"
        : "not_attempted";

  // 診断コード（未設定の場合は登録なしを示す）
  const diagnosticCode: SafeDiagnosticCode | null =
    mode === "unconfigured"
      ? "MCP_REGISTRATION_MISSING"
      : mode === "remote_mcp_unverified"
        ? "MCP_TRANSPORT_UNVERIFIED"
        : null;

  return {
    transport,
    endpointHost,
    fallbackEnabled,
    verificationState,
    diagnosticCode,
  };
}
