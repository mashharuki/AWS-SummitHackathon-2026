import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  ConverseStreamCommand,
  type ConverseStreamCommandInput,
  type ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { IBedrockClient } from "./IBedrockClient.js";

/**
 * IBedrockClient の本番実装 (DP-01)
 *
 * 設定:
 * - retryMode: "adaptive" — 指数バックオフ＋ジッター付きアダプティブリトライ
 * - maxAttempts: 5 — スロットリング (ThrottlingException) への対処
 * - region: ap-northeast-1 — 東京 (クロスリージョン推論プロファイル)
 *
 * NFR 設計: DP-08 — maxTokens は呼び出し元 (TaskExtractorAgent) で管理し、
 * アダプター側は汎用的に保つ。
 *
 * U-03b 拡張: SSE ストリーミングサポートのため converseStream() を追加 (ProposeStream)
 */
export class BedrockClientAdapter implements IBedrockClient {
  private readonly client: BedrockRuntimeClient;

  constructor(region = "ap-northeast-1") {
    this.client = new BedrockRuntimeClient({
      region,
      maxAttempts: 5,
      retryMode: "adaptive",
    });
  }

  async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this.client.send(new ConverseCommand(input));
  }

  async converseStream(
    input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    return this.client.send(new ConverseStreamCommand(input));
  }
}
