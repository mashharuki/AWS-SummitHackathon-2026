/**
 * E2E テスト — SABOROU フロントエンド
 * 注意: ローカルAPI起動が必要なため、CI/CDでは手動実行
 * 実行方法: pnpm e2e（ローカル dev サーバー起動後）
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:5173";

test.describe("ログインページ", () => {
  test("ページタイトルとロゴが表示される", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/SABOROU/i);
    await expect(page.getByText("SABOROU")).toBeVisible();
    await expect(page.getByText("Googleでログイン")).toBeVisible({ timeout: 10000 });
  });

  test("特徴リストが表示される", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByText("タスクを自動で把握")).toBeVisible();
    await expect(page.getByText("安心してサボれる")).toBeVisible();
  });

  test("未認証時は / から /login にリダイレクト", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // ローカルAPIなしでは /tasks → AppShell → /login へリダイレクト
    await expect(page).toHaveURL(/\/login|\/tasks/);
  });
});

test.describe("アクセシビリティ", () => {
  test("ログインページに適切なランドマークがある", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
  });

  test("ログインボタンがフォーカス可能", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // aria-label="Googleアカウントでログイン" でボタンを特定
    const loginBtn = page.getByRole("button", { name: /Google/ });
    await loginBtn.focus();
    await expect(loginBtn).toBeFocused();
  });
});
