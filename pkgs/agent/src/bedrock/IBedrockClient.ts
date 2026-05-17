import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * Abstraction interface for Bedrock Converse API (DP-01: Adapter pattern)
 *
 * Purpose: Isolate AWS SDK dependency to a single file and make it
 * replaceable with a mock in tests (MockBedrockClient).
 *
 * NFR: No real Bedrock calls in unit tests.
 *
 * U-03b extension: converseStream() added for SSE streaming support
 */
export interface IBedrockClient {
  converse(input: ConverseCommandInput): Promise<ConverseCommandOutput>;
  converseStream(
    input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput>;
}
