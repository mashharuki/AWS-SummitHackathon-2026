import { BottomSheet } from "@/components/ui/BottomSheet";
import { Drawer } from "@/components/ui/Drawer";
import { Popover } from "@/components/ui/Popover";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Drawer", () => {
  it("open=false のとき何も描画しない", () => {
    const { container } = render(
      <Drawer open={false} onClose={() => {}}>
        中身
      </Drawer>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("open=true のとき children とタイトルを表示する", () => {
    render(
      <Drawer open onClose={() => {}} title="実績">
        <p>達成リスト</p>
      </Drawer>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "実績");
    expect(screen.getByText("達成リスト")).toBeInTheDocument();
  });

  it("オーバーレイクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="x">
        中身
      </Drawer>,
    );
    // オーバーレイは aria-label="閉じる" の button が複数（オーバーレイ + 閉じるボタン）
    const closers = screen.getAllByLabelText("閉じる");
    fireEvent.click(closers[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc キーで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose}>
        中身
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("side=left を指定できる", () => {
    render(
      <Drawer open onClose={() => {}} side="left" title="左">
        中身
      </Drawer>,
    );
    expect(screen.getByRole("dialog").className).toContain("left-0");
  });

  it("open 時に body スクロールをロックする", () => {
    render(
      <Drawer open onClose={() => {}}>
        中身
      </Drawer>,
    );
    expect(document.body.style.overflow).toBe("hidden");
  });
});

describe("BottomSheet", () => {
  it("open=false のとき何も描画しない", () => {
    const { container } = render(
      <BottomSheet open={false} onClose={() => {}}>
        中身
      </BottomSheet>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("open=true のとき children を表示する", () => {
    render(
      <BottomSheet open onClose={() => {}} title="ゲーム">
        <p>ギルド</p>
      </BottomSheet>,
    );
    expect(screen.getByText("ギルド")).toBeInTheDocument();
    expect(screen.getByText("ゲーム")).toBeInTheDocument();
  });

  it("Esc キーで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        中身
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("オーバーレイクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        中身
      </BottomSheet>,
    );
    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Popover", () => {
  it("初期状態では children を表示しない", () => {
    render(
      <Popover trigger={<span>開く</span>}>
        <p>中身</p>
      </Popover>,
    );
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("トリガークリックで開き、children を表示する", () => {
    render(
      <Popover trigger={<span>開く</span>}>
        <p>中身</p>
      </Popover>,
    );
    fireEvent.click(screen.getByText("開く"));
    expect(screen.getByText("中身")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "開く" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("再クリックで閉じる", () => {
    render(
      <Popover trigger={<span>開く</span>}>
        <p>中身</p>
      </Popover>,
    );
    const trigger = screen.getByText("開く");
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("Esc キーで閉じる", () => {
    render(
      <Popover trigger={<span>開く</span>}>
        <p>中身</p>
      </Popover>,
    );
    fireEvent.click(screen.getByText("開く"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("外側クリックで閉じる", () => {
    render(
      <div>
        <Popover trigger={<span>開く</span>}>
          <p>中身</p>
        </Popover>
        <button type="button">外側</button>
      </div>,
    );
    fireEvent.click(screen.getByText("開く"));
    fireEvent.mouseDown(screen.getByText("外側"));
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("placement=top / align=end を指定できる", () => {
    render(
      <Popover trigger={<span>開く</span>} placement="top" align="end">
        <p>中身</p>
      </Popover>,
    );
    fireEvent.click(screen.getByText("開く"));
    const trigger = screen.getByRole("button", { name: "開く" });
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    expect(panel?.className).toContain("bottom-full");
    expect(panel?.className).toContain("right-0");
  });
});
