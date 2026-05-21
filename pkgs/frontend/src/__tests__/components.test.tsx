import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("VerdictBox", () => {
  it("can_saboru 判定を正しく表示する", () => {
    render(
      <VerdictBox verdict="can_saboru" summaryText="今日は安全にサボれます" />,
    );
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getByText("サボれます")).toBeInTheDocument();
    expect(screen.getByText("今日は安全にサボれます")).toBeInTheDocument();
  });

  it("must_do 判定を正しく表示する", () => {
    render(<VerdictBox verdict="must_do" summaryText="これは急ぎです" />);
    // U-06: VERDICT_META.must_do.label = "やるしかない"
    expect(screen.getByText("やるしかない")).toBeInTheDocument();
  });

  it("borderline 判定を正しく表示する", () => {
    render(<VerdictBox verdict="borderline" summaryText="グレーゾーンです" />);
    // U-06: VERDICT_META.borderline.label = "要検討"
    expect(screen.getByText("要検討")).toBeInTheDocument();
  });

  it("evaluatedAt を表示する", () => {
    render(
      <VerdictBox
        verdict="can_saboru"
        summaryText="サボれます"
        evaluatedAt="5/20 14:30"
      />,
    );
    expect(screen.getByText("5/20 14:30")).toBeInTheDocument();
    expect(screen.getByText(/Claude Sonnet/)).toBeInTheDocument();
  });
});

describe("EvidenceList", () => {
  it("根拠リストを表示する", () => {
    render(<EvidenceList items={["根拠1", "根拠2", "根拠3"]} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("根拠1")).toBeInTheDocument();
  });

  it("空配列の場合は何も表示しない", () => {
    const { container } = render(<EvidenceList items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("カスタムタイトルを表示する", () => {
    render(<EvidenceList items={["item"]} title="カスタムタイトル" />);
    expect(screen.getByText("カスタムタイトル")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("デフォルトバリアントを表示する", () => {
    render(<Badge>テスト</Badge>);
    expect(screen.getByText("テスト")).toBeInTheDocument();
  });

  it("can バリアントのスタイルを適用する", () => {
    const { container } = render(<Badge variant="can">サボれます</Badge>);
    expect(container.firstChild).toHaveClass("text-[#4CAF50]");
  });

  it("must バリアントのスタイルを適用する", () => {
    const { container } = render(<Badge variant="must">やらないと</Badge>);
    expect(container.firstChild).toHaveClass("text-[#F44336]");
  });
});

describe("Button", () => {
  it("クリックイベントを発火する", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>クリック</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled の場合クリックが無効になる", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        クリック
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("variant=outline のスタイルを適用する", () => {
    const { container } = render(
      <Button variant="outline">アウトライン</Button>,
    );
    expect(container.firstChild).toHaveClass("border");
  });

  it("size=lg のスタイルを適用する", () => {
    const { container } = render(<Button size="lg">大きいボタン</Button>);
    expect(container.firstChild).toHaveClass("h-12");
  });
});
