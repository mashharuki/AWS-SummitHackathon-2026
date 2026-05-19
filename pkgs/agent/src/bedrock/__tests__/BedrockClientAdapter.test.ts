import { describe, expect, it } from "vitest";
import { BedrockClientAdapter } from "../BedrockClientAdapter.js";

/**
 * BedrockClientAdapter ユニットテスト
 *
 * 注意: ユニットテストでは実障の Bedrock API 呼び出しは行わない。
 * アダプターがカスタムリージョンでインスタンス化できることと、
 * 公開 API インターフェースが IBedrockClient と一致することを検証する。
 */
describe("BedrockClientAdapter", () => {
  it("can be instantiated with default region", () => {
    const adapter = new BedrockClientAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.converse).toBe("function");
  });

  it("can be instantiated with custom region", () => {
    const adapter = new BedrockClientAdapter("us-east-1");
    expect(adapter).toBeDefined();
    expect(typeof adapter.converse).toBe("function");
  });

  it("implements IBedrockClient interface (duck typing)", () => {
    const adapter = new BedrockClientAdapter();
    // IBedrockClient は ConverseCommandInput を受け取る converse メソッドが必要
    expect(adapter.converse).toBeTypeOf("function");
    // このメソッドは非同期 (Promise を返す)
    // 実障の AWS SDK 呼び出しを防ぐため呼び出しは行わない
  });
});
