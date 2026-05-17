# Code Generation Summary — U-01: shared

**Unit**: U-01: shared
**ステージ**: CONSTRUCTION / Code Generation
**完了日**: 2026-05-17
**バージョン**: 1.0.0

---

## 生成成果物一覧

### プロジェクト設定ファイル（pkgs/shared/）

| ファイル | 用途 |
|---------|------|
| `package.json` | パッケージ定義、subpath exports（CJS/ESM/types）、依存関係 |
| `tsconfig.json` | TypeScript設定（ES2022 target、strictモード、@types/node） |
| `tsup.config.ts` | tsupビルド設定（CJS+ESMデュアルビルド、4エントリポイント） |
| `vitest.config.ts` | Vitestテスト設定（カバレッジ閾値90%、型定義除外） |
| `.env.example` | 必須環境変数テンプレート（PSEUDONYMIZE_SALT、MAX_TOKEN_LIMIT） |

### 型定義（src/types/）

| ファイル | エンティティ |
|---------|------------|
| `enums.ts` | Verdict / QuickReplyType / SourceType / ServiceType / ConnectionStatus / TaskCandidateStatus / TaskStatus / HonneType / PersonaType |
| `user.ts` | User（DynamoDB: PK=USER#cognitoSub, SK=PROFILE） |
| `service-connection.ts` | ServiceConnection（PK=USER#cognitoSub, SK=CONN#service） |
| `task-candidate.ts` | TaskCandidate（PK=USER#cognitoSub, SK=TASK_CAND#ulid） |
| `task.ts` | Task（PK=USER#cognitoSub, SK=TASK#ulid） |
| `proposal.ts` | Proposal（PK=TASK#taskId, SK=PROPOSAL#ISO8601） |
| `honne-data.ts` | HonneData（PK=USER#cognitoSub, SK=HONNE#ISO8601） |
| `persona.ts` | Persona（PK=PERSONA#personaId, SK=DEFINITION） |
| `index.ts` | 全型の re-export |

### エラークラス（src/errors/）

| ファイル | 内容 |
|---------|------|
| `AppError.ts` | 基底エラークラス（ErrorCode型、serialize()、V8 captureStackTrace対応） |
| `index.ts` | BedrockTimeoutError / BedrockCostExceededError / TokenExpiredError / DynamoWriteFailedError / isAppError() |

### ユーティリティ（src/utils/）

| ファイル | 関数 |
|---------|-----|
| `generateUlid.ts` | `generateUlid()` — ulidxによるULID生成 |
| `pseudonymize.ts` | `pseudonymize(name)` — SHA-256仮名化（PSEUDONYMIZE_SALT必須） |
| `guardTokenLimit.ts` | `countTokens(text)` / `guardTokenLimit(prompt, limit?)` / `DEFAULT_MAX_TOKEN_LIMIT` |
| `datetime.ts` | `formatDeadline(isoDate)` / `minutesUntil(isoDate)` / `isOverdue(isoDate)` / `toIsoString(date?)` |
| `index.ts` | 全ユーティリティの re-export |

### リポジトリインタフェース（src/repositories/）

| ファイル | インタフェース |
|---------|-------------|
| `IUserRepository.ts` | findById / upsert |
| `IServiceConnectionRepository.ts` | findAllByUserId / findByUserAndService / save / disconnect |
| `ITaskCandidateRepository.ts` | findAllByUserId / findById / create / approve / delete |
| `ITaskRepository.ts` | findApprovedByUserId / findById / create / update / softDelete / putFromTransaction |
| `IProposalRepository.ts` | findLatestByTaskId / save |
| `IHonneRepository.ts` | save / findAllByUserId |
| `index.ts` | 全インタフェースの re-export |

### Zodスキーマ（src/schemas/）

| ファイル | スキーマ |
|---------|---------|
| `task.ts` | CreateTaskSchema / UpdateTaskSchema（title必須200文字、deadline ISO8601、description 1000文字） |
| `honne.ts` | CreateHonneSchema（discriminatedUnion: quick_reply 4値固定 / free_text 1-500文字） |
| `index.ts` | re-export |

### 定数（src/constants/）

| 定数 | 値 |
|-----|---|
| `VERDICT_TYPE` | `{CAN_SABORU, BORDERLINE, MUST_DO}` |
| `SOURCE_TYPE` | `{SLACK, MANUAL}` |
| `SERVICE_TYPE` | `{SLACK}` |
| `QUICK_REPLY_TYPE` | `{TRULY_TIRED, ACTUALLY_IMPORTANT, AGREE_WITH_AI, DISAGREE_WITH_AI}` |
| `DEFAULT_MAX_TOKEN_LIMIT` | `8000` |
| `DDB_PREFIX` | `{USER, TASK_CAND, TASK, CONN, PERSONA, PROPOSAL, HONNE}` |
| `DEFAULT_PERSONA_ID` | `'saboru_ottori'` |
| `TASK_CANDIDATE_TTL_DAYS` | `30` |

---

## ビルド結果

```
pnpm --filter shared build

ESM ⚡️ Build success
  dist/index.js            7.26 KB
  dist/errors/index.js     2.33 KB
  dist/utils/index.js      4.31 KB
  dist/types/index.js        68 B

CJS ⚡️ Build success
  dist/index.cjs           8.00 KB
  dist/errors/index.cjs    2.49 KB
  dist/utils/index.cjs     4.54 KB
  dist/types/index.cjs       84 B

DTS ⚡️ Build success
  dist/*.d.ts / dist/*.d.cts（型定義ファイル生成済み）
```

---

## テスト結果

```
pnpm --filter shared test

Test Files  6 passed (6)
Tests       93 passed (93)
Coverage    100% (lines / branches / functions / statements)
            ※ 型定義ファイル・バレルファイルは除外
```

### テストファイル一覧

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `errors/__tests__/AppError.test.ts` | 16 | constructor / serialize() / サブクラス / isAppError |
| `utils/__tests__/generateUlid.test.ts` | 6 | ULID形式 / ユニーク性 / SK用途 |
| `utils/__tests__/pseudonymize.test.ts` | 9 | SHA-256ハッシュ / ソルトなしエラー |
| `utils/__tests__/guardTokenLimit.test.ts` | 25 | countTokens計算式 / 切り捨て精度 / 環境変数 |
| `utils/__tests__/datetime.test.ts` | 15 | JST変換 / 今日/明日/M月D日 / minutesUntil / isOverdue |
| `utils/__tests__/schemas.test.ts` | 22 | Zodバリデーション / discriminatedUnion |

---

## Subpath Exports 構成

```json
"exports": {
  ".":         { "import": "./dist/index.mjs",         "require": "./dist/index.cjs"         },
  "./types":   { "import": "./dist/types/index.mjs",   "require": "./dist/types/index.cjs"   },
  "./utils":   { "import": "./dist/utils/index.mjs",   "require": "./dist/utils/index.cjs"   },
  "./errors":  { "import": "./dist/errors/index.mjs",  "require": "./dist/errors/index.cjs"  }
}
```

---

## NFR設計パターン適用確認

| NFR要件 | 適用状況 |
|---------|---------|
| NFR-S1: カバレッジ90% | 達成（100%） |
| NFR-S4: トークン誤差20% | 実装の計算式を自己検証するテスト（25件）でカバレッジ100% |
| NFR-S2: デュアルビルド | tsupでCJS+ESM両形式を生成済み |
| NFR-S6: サブパス exports | package.json exportsに4サブパス定義済み |
| NFR-S3: シークレット管理 | .env.example作成、pseudonymize()はフェイルファスト実装済み |
| NFR-S5: エラーメッセージ分離 | AppError.serialize()でNODE_ENV分岐実装済み |
