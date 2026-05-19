import { render } from "@testing-library/react";
/**
 * SaborouCharacter2D 単体テスト
 * U-06-ui-redesign Phase 2 / character-design-sheet.md 7.1 完了基準準拠
 */
import { describe, expect, it } from "vitest";
import { SaborouAvatar } from "../SaborouAvatar";
import { SaborouCharacter2D } from "../SaborouCharacter2D";

describe("SaborouCharacter2D", () => {
  it("can_saboru verdict でレンダリングできる", () => {
    const { container } = render(<SaborouCharacter2D verdict="can_saboru" />);
    expect(container.querySelector("svg")).toBeTruthy();
    // 接地影
    expect(container.querySelector('ellipse[cy="108"]')).toBeTruthy();
    // ボディ（squircle path）
    expect(container.querySelector("path[d^='M 30 50']")).toBeTruthy();
  });

  it("borderline verdict でレンダリングできる", () => {
    const { container } = render(<SaborouCharacter2D verdict="borderline" />);
    expect(container.querySelector("svg")).toBeTruthy();
    // 太陽（黄色の circle）
    const sun = container.querySelector('circle[cx="42"][cy="14"]');
    expect(sun).toBeTruthy();
    expect(sun?.getAttribute("fill")).toBe("#FCD34D");
  });

  it("must_do verdict でレンダリングできる", () => {
    const { container } = render(<SaborouCharacter2D verdict="must_do" />);
    expect(container.querySelector("svg")).toBeTruthy();
    // 稲妻 path
    expect(container.querySelector("path[d^='M 58 22']")).toBeTruthy();
  });

  it("animated=false でアニメーションが無効になる", () => {
    const { container } = render(
      <SaborouCharacter2D verdict="can_saboru" animated={false} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.animation).toBe("none");
  });

  it("sleeping=true で目を閉じた状態になる", () => {
    const { container } = render(
      <SaborouCharacter2D verdict="can_saboru" sleeping />,
    );
    // 通常の sleepy 目（path）は描画されない
    expect(container.querySelector("path[d^='M 42 64']")).toBeNull();
    // 代わりに rect の閉じ目が描画される
    const closedEyes = container.querySelectorAll('rect[fill="#1F2937"]');
    expect(closedEyes.length).toBe(2);
  });

  it("size prop でサイズが反映される", () => {
    const { container } = render(
      <SaborouCharacter2D verdict="can_saboru" size={56} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe("56px");
    expect(wrapper.style.height).toBe("56px");
  });

  it("can_saboru + animated で Zzz エフェクトが表示される", () => {
    const { container } = render(<SaborouCharacter2D verdict="can_saboru" />);
    expect(container.querySelector("text")?.textContent).toBe("z");
  });

  it("borderline では Zzz エフェクトが表示されない", () => {
    const { container } = render(<SaborouCharacter2D verdict="borderline" />);
    expect(container.querySelector("text")).toBeNull();
  });

  it("aria-label が verdict を反映する", () => {
    const { container } = render(<SaborouCharacter2D verdict="must_do" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.getAttribute("aria-label")).toContain("must_do");
  });
});

describe("SaborouAvatar", () => {
  it("デフォルト 36px でレンダリングできる", () => {
    const { container } = render(<SaborouAvatar />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe("36px");
    expect(wrapper.style.height).toBe("36px");
  });

  it("size prop でサイズが反映される", () => {
    const { container } = render(<SaborouAvatar size={48} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe("48px");
  });

  it("おっとり笑顔（笑顔の口 path）が描画される", () => {
    const { container } = render(<SaborouAvatar />);
    expect(container.querySelector("path[d^='M 17 26']")).toBeTruthy();
  });

  it("オレンジグラデーション背景が適用される", () => {
    const { container } = render(<SaborouAvatar />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.background).toContain("linear-gradient");
    expect(wrapper.style.background).toContain("#F97316");
  });
});
