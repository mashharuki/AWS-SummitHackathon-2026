/**
 * ランタイム設定ヘルパー
 *
 * CDK BucketDeployment が S3 に配置する /env-config.json から読み込み、
 * ローカル開発時は import.meta.env にフォールバックする。
 *
 * main.tsx が loadRuntimeConfig() を呼んだ後に参照すること。
 */

type RuntimeEnv = {
  VITE_API_BASE_URL?: string;
  VITE_COGNITO_USER_POOL_ID?: string;
  VITE_COGNITO_CLIENT_ID?: string;
  VITE_COGNITO_DOMAIN?: string;
  VITE_OAUTH_REDIRECT_URI?: string;
};

declare global {
  interface Window {
    __SABOROU_ENV__?: RuntimeEnv;
  }
}

export function getRuntimeConfig(key: keyof RuntimeEnv): string {
  return (
    window.__SABOROU_ENV__?.[key] ??
    (import.meta.env[key] as string | undefined) ??
    ""
  );
}
