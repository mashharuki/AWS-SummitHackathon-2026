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

// AbortSignal timeout for Bedrock calls.
// throwOnRequestTimeout: true (NodeHttpHandler) throws but does NOT destroy the
// underlying TCP socket, leaving a dangling event-loop entry that keeps Lambda
// alive until the 29 s hard timeout.  AbortController.abort() tells the AWS SDK
// to destroy the socket immediately, so Lambda can exit cleanly after ~24 s.
const BEDROCK_TIMEOUT_MS = 24_000;

export class BedrockClientAdapter implements IBedrockClient {
  private readonly client: BedrockRuntimeClient;

  // biome-ignore lint/complexity/useLiteralKeys: env var name contains underscores, bracket notation is clearer
  constructor(region = process.env["BEDROCK_REGION"] ?? "ap-northeast-1") {
    this.client = new BedrockRuntimeClient({
      region,
      maxAttempts: 5,
      retryMode: "adaptive",
    });
  }

  async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
    try {
      return await this.client.send(new ConverseCommand(input), {
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async converseStream(
    input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
    try {
      return await this.client.send(new ConverseStreamCommand(input), {
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
