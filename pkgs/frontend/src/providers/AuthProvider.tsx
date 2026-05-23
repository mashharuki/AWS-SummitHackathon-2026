import { getMe } from "@/lib/apiClient";
import {
  buildCognitoAuthUrl,
  buildSignOutUrl,
  clearTokens,
  getRefreshToken,
  refreshAccessToken,
  setAccessToken,
  setIdToken,
  setRefreshToken,
} from "@/lib/cognito";
import type { User } from "@saboru/shared";
/**
 * AuthProvider — Cognito JWT 管理
 * NFR-DESIGN-1: メモリ内トークン管理
 * NFR-DESIGN-2: OAuth CSRF 防止
 */
import * as React from "react";

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
    idToken: string,
    refreshToken: string,
    expiresIn: number,
  ) => Promise<void>;
  /** ログイン中ユーザーの一部フィールドを更新する（例: ペルソナ変更の即時反映） */
  updateUser: (patch: Partial<User>) => void;
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
    void buildCognitoAuthUrl().then((url) => {
      window.location.href = url;
    });
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
    async (
      accessToken: string,
      idToken: string,
      refreshToken: string,
      expiresIn: number,
    ) => {
      setAccessToken(accessToken, expiresIn);
      // API 認証には id_token を使う（name/email クレームを含むため）
      setIdToken(idToken);
      setRefreshToken(refreshToken);
      const user = await getMe();
      setState({ user, isAuthenticated: true, isLoading: false });
    },
    [],
  );

  const updateUser = React.useCallback((patch: Partial<User>) => {
    setState((prev) =>
      prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev,
    );
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    handleCallback,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
