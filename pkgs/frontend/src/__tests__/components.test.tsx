import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    expect(screen.getByText("やらないとまずい")).toBeInTheDocument();
  });

  it("borderline 判定を正しく表示する", () => {
    render(<VerdictBox verdict="borderline" summaryText="グレーゾーンです" />);
    expect(screen.getByText("ボーダーライン")).toBeInTheDocument();
  });

  it("todayMessage を表示する", () => {
    render(
      <VerdictBox
        verdict="can_saboru"
        summaryText="サボれます"
        todayMessage="今日は最高の日です！"
      />,
    );
    expect(screen.getByText("今日は最高の日です！")).toBeInTheDocument();
  });

  it("達成度を表示する", () => {
    render(
      <VerdictBox
        verdict="can_saboru"
        summaryText="サボれます"
        completionRate={87}
      />,
    );
    expect(screen.getByText("達成度 87%")).toBeInTheDocument();
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
