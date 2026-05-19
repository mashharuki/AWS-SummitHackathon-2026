import { useAuthContext } from "@/providers/AuthProvider";

/** 認証フック — AuthProvider のコンテキストへの簡便なアクセス */
export function useAuth() {
  return useAuthContext();
}
