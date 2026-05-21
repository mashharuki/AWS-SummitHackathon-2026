import { useToastContext } from "@/providers/ToastProvider";

/** Toast 通知フック */
export function useToast() {
  return useToastContext();
}
