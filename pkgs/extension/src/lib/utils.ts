import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind CSS クラス名マージ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
