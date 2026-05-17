/**
 * AuthProvider — Cognito JWT 管理
 * NFR-DESIGN-1: メモリ内トークン管理
 * NFR-DESIGN-2: OAuth CSRF 防止
 */
import * as React from "react";
import type { User } from "@saboru/shared";
import { getMe } from "@/lib/apiClient";
import {
  buildCognitoAuthUrl,
  buildSignOutUrl,
  clearTokens,
  getRefreshToken,
  refreshAccessToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/cognito";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: () => void;
  signOut: () => Promise<void>;
  handleCallback: (
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // 初期化: リフレッシュトークンがあれば復元
  React.useEffect(() => {
    // モックモード: Cognito を介さずログイン済み扱いにする（ローカル UI 検証用）
    if (import.meta.env["VITE_USE_MOCK"] === "true") {
      getMe()
        .then((user) => {
          setState({ user, isAuthenticated: true, isLoading: false });
        })
        .catch(() => {
          setState({ user: null, isAuthenticated: false, isLoading: false });
        });
      return;
    }

    const rt = getRefreshToken();
    if (!rt) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    refreshAccessToken()
      .then(async (newToken) => {
        if (!newToken) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        setAccessToken(newToken);
        try {
          const user = await getMe();
          setState({ user, isAuthenticated: true, isLoading: false });
        } catch {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      })
      .catch(() => {
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      });
  }, []);

  const signIn = React.useCallback(() => {
    window.location.href = buildCognitoAuthUrl();
  }, []);

  const signOut = React.useCallback(async () => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
    // モックモードでは Cognito ログアウト URL へ遷移せずログイン画面に戻す
    if (import.meta.env["VITE_USE_MOCK"] === "true") {
      window.location.href = "/login";
      return;
    }
    window.location.href = buildSignOutUrl();
  }, []);

  const handleCallback = React.useCallback(
    async (accessToken: string, refreshToken: string, expiresIn: number) => {
      setAccessToken(accessToken, expiresIn);
      setRefreshToken(refreshToken);
      const user = await getMe();
      setState({ user, isAuthenticated: true, isLoading: false });
    },
    [],
  );

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    handleCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
