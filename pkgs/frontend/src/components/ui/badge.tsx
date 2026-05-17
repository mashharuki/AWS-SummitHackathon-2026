import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#FF6B2B] text-white",
        can: "bg-[#F0FFF4] text-[#4CAF50] border border-[#4CAF50]/30",
        borderline: "bg-[#FFF8F0] text-[#FF9800] border border-[#FF9800]/30",
        must: "bg-[#FFF5F5] text-[#F44336] border border-[#F44336]/30",
        secondary: "bg-[#F5F4F0] text-[#6B7280]",
        outline: "border border-[#E5E7EB] text-[#6B7280]",
        connected: "bg-green-50 text-green-700 border border-green-200",
        disconnected: "bg-gray-50 text-gray-500 border border-gray-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
