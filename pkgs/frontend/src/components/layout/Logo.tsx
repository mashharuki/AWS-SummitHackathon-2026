/**
 * SABOROU ブランドロゴ — SaborouAvatar + テキスト
 * U-06-ui-redesign Phase 4
 */
import { SaborouAvatar } from "@/components/character/SaborouAvatar";

export interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <SaborouAvatar size={size} />
      <span
        className="font-extrabold tracking-tight text-saboru-ink"
        style={{
          fontFamily: "Space Grotesk, system-ui, sans-serif",
          fontSize: size * 0.64,
          letterSpacing: "-0.04em",
        }}
      >
        SABOROU
      </span>
    </div>
  );
}
