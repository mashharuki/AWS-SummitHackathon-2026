/**
 * SectionLabel — セクション見出し（共有 HTML SectionLabel 準拠）
 * U-06-ui-redesign Phase 4
 */
import type { ReactNode } from "react";

export interface SectionLabelProps {
  children: ReactNode;
  /** 右側に補助情報を表示（件数など） */
  hint?: ReactNode;
}

export function SectionLabel({ children, hint }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between px-1 mb-1.5">
      <h2
        className="text-saboru-ink-soft font-bold"
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "none",
        }}
      >
        {children}
      </h2>
      {hint && (
        <span className="text-saboru-ink-muted" style={{ fontSize: 10 }}>
          {hint}
        </span>
      )}
    </div>
  );
}
