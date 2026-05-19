/**
 * PageHeader — ページ上部ヘッダー（戻る/タイトル/サブタイトル/右スロット）
 *
 * U-06-ui-redesign Phase 4
 * 共有 HTML `Header` の仕様に準拠（太い黒下枠でブルータルさを継承）
 */
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: PageHeaderProps) {
  return (
    <header
      className="bg-saboru-paper flex items-center gap-2 px-4 pt-3.5 pb-3"
      style={{ borderBottom: "3px solid #2B1E16" }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="戻る"
          className="text-saboru-ink-soft hover:text-saboru-ink p-1 -ml-1"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1
          className="font-bold text-saboru-ink truncate"
          style={{ fontSize: 16, letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-saboru-ink-muted mt-0.5 truncate"
            style={{ fontSize: 11 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </header>
  );
}
