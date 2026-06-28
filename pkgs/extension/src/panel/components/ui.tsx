/**
 * ui.tsx — 拡張パネル共通 UI コンポーネント
 *
 * frontend のデザイントークン（neo-brutalism: #f97316 / #2b1e16 / ハードシャドウ）を
 * 踏襲しつつ、Side Panel 400px 幅に最適化した最小セット。
 */

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  accent,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** 枠線・影のアクセント色（既定はダークブラウン） */
  accent?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const border = accent ?? "#2b1e16";
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border-2 p-3",
        "transition-shadow",
        className,
      )}
      style={{
        borderColor: border,
        boxShadow: `0 3px 0 ${border}`,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "orange" | "green" | "amber" | "red" | "slack";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[#f3f4f6] text-[#6b7280] border-[#d1d5db]",
  orange: "bg-[#fed7aa] text-[#9a3412] border-[#f97316]",
  green: "bg-[#d1fae5] text-[#065f46] border-[#10b981]",
  amber: "bg-[#fef3c7] text-[#92400e] border-[#f59e0b]",
  red: "bg-[#fee2e2] text-[#991b1b] border-[#ef4444]",
  slack: "bg-[#f3e8f5] text-[#4a154b] border-[#4a154b]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
        "text-[10px] font-bold border",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "ghost" | "danger" | "outline";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[#f97316] text-white border-[#2b1e16] shadow-[0_3px_0_#2b1e16] hover:bg-[#ea580c] active:translate-y-[3px] active:shadow-none",
  danger:
    "bg-white text-[#991b1b] border-[#ef4444] shadow-[0_3px_0_#ef4444] hover:bg-[#fef2f2] active:translate-y-[3px] active:shadow-none",
  outline:
    "bg-white text-[#1f2937] border-[#2b1e16] shadow-[0_3px_0_#2b1e16] hover:bg-[#f3f4f6] active:translate-y-[3px] active:shadow-none",
  ghost: "bg-transparent text-[#6b7280] border-transparent hover:bg-[#f3f4f6]",
};

export function Button({
  children,
  variant = "primary",
  className,
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        "px-4 py-2 rounded-xl text-sm font-bold border-2",
        "transition-all duration-100",
        disabled
          ? "bg-[#f3f4f6] text-[#9ca3af] border-[#e5e7eb] shadow-none cursor-not-allowed"
          : BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel — カード群の小見出し
// ---------------------------------------------------------------------------

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold text-[#9ca3af] tracking-wide px-1 mb-1.5">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Modal — 中央表示のダイアログ（承認モーダル等）
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* バックドロップ: クリック / Esc で閉じる */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        data-testid="modal-backdrop"
      />
      <div
        className={cn(
          "relative w-full max-h-[88vh] overflow-y-auto",
          "bg-[#fffaf5] border-t-2 border-x-2 border-[#2b1e16]",
          "rounded-t-2xl shadow-[0_-4px_0_#2b1e16]",
          "animate-[slideUp_0.18s_ease-out]",
        )}
        data-testid="modal-panel"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#f3f4f6] sticky top-0 bg-[#fffaf5]">
          <div className="text-sm font-bold text-[#1f2937]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#f3f4f6] text-[#9ca3af]"
            aria-label="閉じる"
            data-testid="modal-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t-2 border-[#f3f4f6] sticky bottom-0 bg-[#fffaf5] flex gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricBar — 0-100 のレベルバー（見えるもの・心理シグナル用）
// ---------------------------------------------------------------------------

export function MetricBar({
  value,
  color = "#f97316",
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-[#f3f4f6] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      {icon && <div className="mb-3 text-[#d1d5db]">{icon}</div>}
      <p className="text-sm font-bold text-[#6b7280]">{title}</p>
      {hint && <p className="mt-1 text-xs text-[#9ca3af]">{hint}</p>}
    </div>
  );
}
