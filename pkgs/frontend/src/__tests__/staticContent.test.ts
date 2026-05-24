import {
  MANUAL_PROGRESS,
  MANUAL_TRAITS,
  PERSONAS,
  PERSONA_BANNERS,
  ROADMAP_ITEMS,
} from "@/lib/staticContent";
import { describe, expect, it } from "vitest";

describe("staticContent", () => {
  it("MANUAL_TRAITSがエクスポートされている", () => {
    expect(Array.isArray(MANUAL_TRAITS)).toBe(true);
  });

  it("MANUAL_PROGRESSが正しい形状を持つ", () => {
    expect(typeof MANUAL_PROGRESS.collected).toBe("number");
    expect(typeof MANUAL_PROGRESS.total).toBe("number");
  });

  it("PERSONASが配列としてエクスポートされている", () => {
    expect(Array.isArray(PERSONAS)).toBe(true);
    expect(PERSONAS.length).toBeGreaterThan(0);
  });

  it("各ペルソナが必須フィールドを持つ", () => {
    for (const persona of PERSONAS) {
      expect(persona.id).toBeTruthy();
      expect(persona.name.ja).toBeTruthy();
      expect(typeof persona.available).toBe("boolean");
    }
  });

  it("PERSONA_BANNERSがオブジェクトとしてエクスポートされている", () => {
    expect(typeof PERSONA_BANNERS).toBe("object");
    expect(PERSONA_BANNERS).not.toBeNull();
  });

  it("ROADMAP_ITEMSが配列としてエクスポートされている", () => {
    expect(Array.isArray(ROADMAP_ITEMS)).toBe(true);
  });
});
