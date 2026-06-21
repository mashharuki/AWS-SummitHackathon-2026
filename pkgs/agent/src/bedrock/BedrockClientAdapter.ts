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
// AbortController.abort() tells the AWS SDK to destroy the socket immediately,
// so Lambda can exit cleanly.  Lambda timeout is 60 s; we abort at 50 s to
// leave headroom for post-abort work (Marp render + S3 upload).
const BEDROCK_TIMEOUT_MS = 50_000;

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
    const timer = setTimeout(() => {
      console.log(`[BedrockClientAdapter] abort fired after ${BEDROCK_TIMEOUT_MS}ms model=${input.modelId}`);
      controller.abort();
    }, BEDROCK_TIMEOUT_MS);
    console.log(`[BedrockClientAdapter] converse start model=${input.modelId}`);
    try {
      const result = await this.client.send(new ConverseCommand(input), {
        abortSignal: controller.signal,
      });
      console.log(`[BedrockClientAdapter] converse success model=${input.modelId}`);
      return result;
    } catch (err) {
      console.log(`[BedrockClientAdapter] converse error model=${input.modelId} name=${(err as Error)?.name} msg=${(err as Error)?.message?.slice(0, 120)}`);
      throw err;
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
