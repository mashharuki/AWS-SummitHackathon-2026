---
name: travelpayouts-travel-product
description: Travelpayouts APIを使った旅行プランニング、航空券検索、旅行商品レコメンド、アフィリエイト導線、収益分析を含むプロダクトの設計・実装・テストを支援する。Travelpayouts、Aviasales、Flight Search API、Data API、GraphQL、partner links、booking statistics、DiscoverCars、GetTransfer、Kiwi.com、Omio、Tiqets、WeGoTrip、Viator、Airalo、eSIM、旅行API、旅行プラン作成、航空券検索、旅程生成、旅行アフィリエイト、旅行予約導線、旅行データフィードが出たら必ず使う。
---

# Travelpayouts Travel Product

TravelpayoutsとAviasales系APIを使う旅行プロダクトを、要件定義から設計、実装、テスト、運用前レビューまで一気通貫で支援する。
APIは「ユーザー体験」「収益導線」「利用規約・API制約」の3つを同時に満たす必要があるため、機能選定より先にユースケースとAPI利用境界を明確にする。

## まず読む参照ファイル

必要なものだけ読む。

- `references/api-capability-map.md`: どのTravelpayouts/Aviasales APIを何に使うか選ぶとき。
- `references/architecture-and-implementation.md`: 実装方針、認証、キャッシュ、バックエンド構成、リンク生成、データモデルを設計するとき。
- `references/testing-and-quality.md`: テスト計画、モック、契約テスト、レート制限、収益トラッキングを検証するとき。
- `references/compliance-and-risk.md`: Search API規約、サーバーサイド制約、SEO制約、アフィリエイトリンク生成、個人情報や支払いデータを扱うとき。

## 実行フロー

1. 目的を分類する。
   - 旅程提案: 都市・空港・観光・eSIM・移動・日帰り体験を組み合わせる。
   - 航空券探索: キャッシュデータ、GraphQL、リアルタイムSearch APIのどれが必要か切り分ける。
   - 収益化: partner links、sub_id、booking statistics、balance/paymentの設計を含める。
   - 運用分析: statistics APIでKPI、CVR、キャンセル、収益見込み、実績を追う。

2. APIアクセスと制約を確認する。
   - Travelpayouts API token、marker、trs/project ID、接続済みブランド、Aviasales Search APIのアクセス可否を確認する。
   - Search APIはユーザー操作起点、サーバーサイド実行、予約リンクの遅延生成、検索結果ページのnoindex/robots制御を前提にする。
   - Data APIとGraphQLはキャッシュ由来の旅行インサイト、Search APIはリアルタイム検索として扱い、用途を混同しない。

3. API構成を設計する。
   - Autocomplete/whereami/data feedsで入力補助と初期値を作る。
   - Aviasales Data APIまたはGraphQLで候補生成、価格傾向、人気方面、静的/準静的ページを作る。
   - Flight Search APIは明示的な検索画面に限定し、Bookクリック時だけbooking/deep linkを生成する。
   - DiscoverCars、GetTransfer、Tiqets、WeGoTrip、Viator、Airaloなどは旅程の補助商品として、アクセス要件とリンク変換方式を明示する。

4. 実装する。
   - API tokenはサーバー側の環境変数またはSecrets Manager等に置き、クライアントへ渡さない。
   - Travelpayouts APIクライアントはAPI種別ごとに分け、認証方式、レート制限、リトライ、キャッシュTTL、レスポンス正規化を明示する。
   - 価格は期限、通貨、取得元、キャッシュ/リアルタイム種別をデータモデルに含める。
   - アフィリエイトリンクは生成元URL、partner_url、marker、trs、sub_id、生成時刻、失敗理由を追跡する。

5. テストする。
   - 外部APIは契約テストとモックを分ける。CIでは原則モック、本番前に限定的な実API疎通を行う。
   - 429、401、400、304、5xx、空データ、期限切れ価格、未接続ブランド、partner link生成失敗を必ずテストする。
   - Search API利用時は規約チェックリストをテスト観点に含める。

## 代表的な成果物

- 要件定義: APIアクセス前提、旅行者ペルソナ、旅程生成ユースケース、収益化KPI。
- アーキテクチャ: BFF/API gateway、Travelpayouts adapter、cache、analytics pipeline、link generation service。
- 実装: typed API client、rate limiter、cache policy、affiliate link service、statistics ingestion job。
- テスト: API contract fixtures、mock server、Search API compliance tests、revenue tracking tests。
- 運用: レート制限メトリクス、APIエラー分類、リンク生成失敗率、sub_id別CVR、収益レポート。

## デフォルト設計判断

- ユーザーが「航空券候補を見たい」だけなら、まずData APIまたはGraphQLを使う。リアルタイム在庫・複雑なmulti-city検索が必要な場合だけSearch APIを検討する。
- 静的SEOページにはData APIやデータフィードを使う。Search API結果ページは検索エンジンに公開しない。
- 収益導線は最初からsub_id設計を入れる。後から追加すると分析とA/Bテストが崩れる。
- 旅行プランは「航空券 + 現地移動 + 観光/体験 + eSIM + 分析」のモジュール構成にする。ブランド別APIのアクセス要件や更新頻度が違うため、疎結合に保つ。

## 回答スタイル

- 具体的なAPI名、エンドポイント種別、認証方式、制約、テスト観点を明記する。
- Travelpayouts公式ドキュメントに依存する仕様は、必要に応じて最新確認を促すかWeb確認する。
- API token、marker、trs、username/password、顧客連絡先、支払い情報は絶対にハードコードしない。
- 規約違反になり得る自動収集、Bookingリンク事前生成、クライアント直接API呼び出し、Search API結果ページのSEO公開を見つけたら実装前に止める。
