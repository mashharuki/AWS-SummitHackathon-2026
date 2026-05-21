import { describe, expect, it, vi } from "vitest";
import { log, logError, logInfo, logWarn } from "../logger.js";

describe("logger", () => {
  it("outputs structured JSON with INFO level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo({ action: "test_info" });
    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string) as {
      level: string;
      action: string;
    };
    expect(payload.level).toBe("INFO");
    expect(payload.action).toBe("test_info");
    spy.mockRestore();
  });

  it("outputs WARN level via logWarn()", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logWarn({ action: "test_warn" });
    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string) as {
      level: string;
    };
    expect(payload.level).toBe("WARN");
    spy.mockRestore();
  });

  it("outputs ERROR level via logError()", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logError({ action: "test_error" });
    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string) as {
      level: string;
    };
    expect(payload.level).toBe("ERROR");
    spy.mockRestore();
  });

  it("supports direct log() calls", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("INFO", { action: "direct_log" });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
