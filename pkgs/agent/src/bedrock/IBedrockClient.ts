import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * Bedrock Converse API の抽象化インターフェース (DP-01: Adapter パターン)
 *
 * 目的: AWS SDK 依存を単一ファイルに限定し、テストで
 * モック (MockBedrockClient) に差し替えられるようにする。
 *
 * NFR: ユニットテストでは実際の Bedrock 呼び出しを行わない。
 *
 * U-03b 拡張: SSE ストリーミングサポートのため converseStream() を追加
 */
export interface IBedrockClient {
  converse(input: ConverseCommandInput): Promise<ConverseCommandOutput>;
  converseStream(
    input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput>;
}
