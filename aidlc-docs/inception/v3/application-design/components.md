# SABOROU v3 Component Design

**作成日**: 2026-06-16
**対象**: MCP Serverization Application Design

---

## C-V3-01: AgentCoreGatewayFacade

**責務**: ElevenLabs AgentからのMCP tool call入口を提供し、公開ツール、認証方式、Gateway Targetを統制する。

**入力**:

- Cognito JWT付きMCP request
- MCP tool name and arguments

**出力**:

- Tool result JSON
- Auth/validation error

**依存コンポーネント**:

- C-V3-02 McpToolAdapter
- C-V3-03 McpIdentityResolver
- C-V3-04 McpToolRegistry

**AWSサービスマッピング**:

- Amazon Bedrock AgentCore Gateway
- Amazon S3 for OpenAPI schema
- IAM role for Gateway target execution

---

## C-V3-02: McpToolAdapter

**責務**: AgentCore Gatewayから受けたtool callを、既存Hono APIまたは内部サービス呼び出しに変換するFacade層。

**入力**:

- Tool name
- Tool arguments
- Resolved user identity
- Human approval metadata

**出力**:

- Normalized tool result
- Safe error response

**依存コンポーネント**:

- C-V3-03 McpIdentityResolver
- C-V3-04 McpToolRegistry
- C-V3-05 SlackDelegationService
- Existing task/proposal/google/slack services

**AWSサービスマッピング**:

- Lambda handler or existing Hono Lambda route adapter

**Design Decision**:

既存Hono APIをOpenAPI Targetでそのまま呼ぶ案は、API Gateway JWT AuthorizerとGateway IAM roleの不整合がある。v3ではAdapter層を設け、AgentCoreからの呼び出しで信頼できるuserIdを確定してから既存ドメイン処理へ委譲する。

---

## C-V3-03: McpIdentityResolver

**責務**: AgentCoreで検証済みのCognito JWTまたはGateway-provided contextから、Hono/サービス層で使う `userId` を決定する。

**入力**:

- AgentCore-authorized request metadata
- Cognito claims if available
- Tool request context

**出力**:

- `userId`
- Auth decision
- Audit metadata

**依存コンポーネント**:

- Existing Cognito configuration
- Existing `authMiddleware` semantics

**AWSサービスマッピング**:

- Cognito User Pool
- AgentCore Gateway Custom JWT authorizer

---

## C-V3-04: McpToolRegistry

**責務**: MCP公開対象ツールのallowlist、operationId、input/output schema、side-effect classificationを管理する。

**入力**:

- Tool name
- OpenAPI operation metadata

**出力**:

- Tool definition
- Validation schema
- Side-effect policy

**依存コンポーネント**:

- AgentCore OpenAPI schema file
- Backend route contracts

**AWSサービスマッピング**:

- S3 schema object
- CDK schema deployment

---

## C-V3-05: SlackDelegationService

**責務**: 選択タスクから `@Claude` 向け依頼文を生成し、明示承認後にSlackへ投稿する。

**入力**:

- `taskId`
- `channelId`
- optional `threadTs`
- explicit approval flag
- optional instruction overrides

**出力**:

- Slack `ts`
- delegated task summary
- safe error response

**依存コンポーネント**:

- Existing `SlackClient`
- Existing `DynamoTaskRepository`
- Existing per-user Slack token retrieval

**AWSサービスマッピング**:

- Hono API Lambda
- Secrets Manager for per-user Slack Bot Token
- DynamoDB tasks table

---

## C-V3-06: VoiceToolClient

**責務**: Chrome拡張のElevenLabs `clientTools` をMCP本線から外し、UI補助または既存Hono fallbackとして扱う。MCP本線はElevenLabs Dashboardに登録する `streamable_http` または `sse` のリモートMCPサーバーとする。

**入力**:

- Fallback/UI tool call from ElevenLabs SDK or extension UI
- Cognito JWT from extension auth
- Current Slack/task context

**出力**:

- Fallback tool result JSON string to extension UI or ElevenLabs clientTools
- UI state updates

**依存コンポーネント**:

- `agentClient.ts`
- `useConversationalAgent.ts`
- Extension auth token provider

**AWSサービスマッピング**:

- Registered SABOROU MCP endpoint: `streamable_http` primary, `sse` fallback
- AgentCore Gateway endpoint or SSE bridge endpoint
- Existing API Gateway endpoint

---

## C-V3-07: McpVerificationHarness

**責務**: 実AWS / AgentCore / ElevenLabs / Slack接続の検証手順と結果記録を提供する。

**入力**:

- Gateway URL
- Cognito token
- ElevenLabs Agent configuration
- Slack test channel

**出力**:

- Verification result
- Failure diagnosis
- Demo handoff instructions

**依存コンポーネント**:

- CDK outputs
- AgentCore CLI/API
- Existing v2 setup guide

**AWSサービスマッピング**:

- AgentCore control/data plane
- API Gateway
- CloudWatch Logs
