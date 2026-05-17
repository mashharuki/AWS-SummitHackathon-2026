import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type ConverseStreamCommandInput,
  type ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { IBedrockClient } from "./IBedrockClient.js";

/**
 * Production implementation of IBedrockClient (DP-01)
 *
 * Configuration:
 * - retryMode: "adaptive" — Adaptive retry with exponential backoff + jitter
 * - maxAttempts: 5 — Handles transient throttling (ThrottlingException)
 * - region: ap-northeast-1 — Tokyo (cross-region inference profile)
 *
 * NFR Design: DP-08 — maxTokens is enforced at the call site (TaskExtractorAgent),
 * not here, so this adapter remains general-purpose.
 *
 * U-03b extension: converseStream() added for SSE streaming support (ProposeStream)
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
