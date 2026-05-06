# 開発コマンド集（Suggested Commands）

## Git操作
```bash
git status
git add .
git commit -m "feat: ..."
git push origin main
git pull origin main
```

## ファイル・ディレクトリ操作（macOS/Darwin）
```bash
ls -la
find . -name "*.ts" -not -path "*/node_modules/*"
grep -r "pattern" --include="*.ts"
```

## AI-DLCワークフロー関連
- aidlc-docs/ 配下にドキュメントを配置
- aidlc-state.md でワークフロー状態を管理
- audit.md で全操作ログを管理

## アプリケーション（未定 - 開発開始後に更新）
- セットアップ後に追加予定

## CodeRabbitレビュー
- PRを作成すると自動でレビューが走る（日本語）

## 注意事項
- アプリコードは aidlc-docs/ には置かない
- ドキュメントのみ aidlc-docs/ へ
