# CDKでデプロイする前に全てのコンポーネントをビルドする
pnpm run -r build
# CDKデプロイ
pnpm cdk run deploy --require-approval never --all