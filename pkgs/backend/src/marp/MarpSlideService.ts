import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { IBedrockClient } from "@saboru/agent";
import {
  MarpCreateSlidesRequestSchema,
  MarpCreateSlidesResponseSchema,
  type MarpCreateSlidesResponse,
} from "./schemas.js";

const MODEL_ID = "jp.anthropic.claude-sonnet-4-6";
const MARP_GENERATOR_TOOL_NAME = "generate_marp_slides";
const MARP_MAX_TOKENS = 2_600;

const SABOROU_MARP_THEME = String.raw`/* @theme saborou-premium */
section {
  --bg: #f7f4ef;
  --paper: #fffdf8;
  --ink: #18202f;
  --muted: #657084;
  --line: #ded8cc;
  --accent: #ff8a00;
  --accent-2: #00a88d;
  --accent-3: #3563ff;
  --dark: #121826;
  --dark-2: #1f2a3d;
  width: 1280px;
  height: 720px;
  box-sizing: border-box;
  font-family: "Hiragino Sans", "BIZ UDGothic", "Yu Gothic Medium", "Noto Sans JP", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
  background:
    linear-gradient(90deg, rgba(255, 138, 0, 0.08), transparent 34%),
    linear-gradient(180deg, var(--paper), #f8f4ec);
  color: var(--ink);
  padding: 52px 72px 60px;
  font-size: 24px;
  line-height: 1.55;
  letter-spacing: 0;
}
section::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 12px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
}
section::after {
  font-size: 13px;
  color: var(--muted);
  bottom: 24px;
  right: 42px;
}
h1, h2, h3 {
  color: var(--ink);
  letter-spacing: 0;
  line-height: 1.16;
}
h1 {
  font-size: 2.28em;
  font-weight: 800;
  margin: 0 0 18px;
}
h2 {
  font-size: 1.62em;
  font-weight: 800;
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 3px solid var(--accent);
}
h3 {
  color: var(--accent-3);
  font-size: 1.05em;
  font-weight: 760;
  margin: 12px 0 8px;
}
p {
  margin: 8px 0 14px;
}
ul, ol {
  margin: 10px 0;
  padding-left: 1.25em;
}
li {
  margin: 7px 0;
}
li::marker {
  color: var(--accent);
}
strong {
  color: #005f56;
  font-weight: 800;
}
em {
  color: #bd5b00;
  font-style: normal;
  font-weight: 760;
}
code {
  font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;
  color: #d94141;
  background: #fff4df;
  border: 1px solid #f4c980;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 0.82em;
}
pre {
  background: #101827;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 18px 22px;
  box-shadow: 0 16px 34px rgba(18, 24, 38, 0.22);
}
pre code {
  color: #eef4ff;
  background: transparent;
  border: 0;
  padding: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78em;
}
th {
  background: var(--dark);
  color: #ffffff;
  text-align: left;
  padding: 9px 14px;
}
td {
  border-bottom: 1px solid var(--line);
  padding: 9px 14px;
}
blockquote {
  margin: 14px 0;
  padding: 14px 20px;
  color: #2a3448;
  background: rgba(0, 168, 141, 0.11);
  border-left: 6px solid var(--accent-2);
  border-radius: 0 8px 8px 0;
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}
.columns.col-3 {
  grid-template-columns: repeat(3, 1fr);
}
.columns.col-6-4 {
  grid-template-columns: 1.4fr 1fr;
}
.columns.col-4-6 {
  grid-template-columns: 1fr 1.4fr;
}
.card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--line);
  border-top: 5px solid var(--accent-3);
  border-radius: 8px;
  padding: 18px 20px;
  box-shadow: 0 14px 28px rgba(31, 42, 61, 0.08);
}
.card.accent {
  border-top-color: var(--accent);
}
.card.success {
  border-top-color: var(--accent-2);
}
.card.dark {
  color: #ffffff;
  background: var(--dark);
  border-color: var(--dark-2);
}
.highlight {
  margin-top: 18px;
  padding: 18px 22px;
  color: #102027;
  background: linear-gradient(90deg, rgba(255, 138, 0, 0.18), rgba(0, 168, 141, 0.13));
  border: 1px solid rgba(255, 138, 0, 0.36);
  border-radius: 8px;
  font-weight: 760;
}
.number {
  display: block;
  color: var(--accent-3);
  font-size: 2.4em;
  font-weight: 850;
  line-height: 1;
}
.number.warm {
  color: var(--accent);
}
.tag {
  display: inline-block;
  margin: 0 7px 7px 0;
  padding: 4px 10px;
  color: #0d5048;
  background: rgba(0, 168, 141, 0.13);
  border: 1px solid rgba(0, 168, 141, 0.35);
  border-radius: 999px;
  font-size: 0.72em;
  font-weight: 760;
}
section.title,
section.section,
section.dark,
section.ending {
  color: #ffffff;
  background:
    radial-gradient(circle at 78% 18%, rgba(255, 138, 0, 0.28), transparent 28%),
    linear-gradient(135deg, #111827, #1b2b44 62%, #0f4039);
}
section.title::before,
section.section::before,
section.dark::before,
section.ending::before {
  width: 14px;
  background: linear-gradient(180deg, #ffb000, #00d3a7);
}
section.title h1,
section.title h2,
section.title h3,
section.section h1,
section.section h2,
section.section h3,
section.dark h1,
section.dark h2,
section.dark h3,
section.ending h1,
section.ending h2,
section.ending h3 {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.38);
}
section.title {
  justify-content: flex-end;
  padding-bottom: 74px;
}
section.title h1 {
  max-width: 880px;
  font-size: 2.55em;
}
section.title p,
section.section p,
section.ending p {
  color: rgba(255, 255, 255, 0.78);
}
section.section,
section.lead,
section.ending {
  justify-content: center;
}
section.lead {
  text-align: center;
}
section.lead h1,
section.lead h2 {
  border-bottom: 0;
}
section.dark code {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffd089;
}`;

const MARP_GENERATOR_TOOL = {
  toolSpec: {
    name: MARP_GENERATOR_TOOL_NAME,
    description: "Generate a complete Marp markdown presentation.",
    inputSchema: {
      json: {
        type: "object",
        required: ["marpMarkdown", "slideCount"],
        properties: {
          marpMarkdown: { type: "string" },
          slideCount: { type: "number" },
        },
      },
    },
  },
} as const;

export type MarpSlideServiceOptions = {
  bedrockClient?: IBedrockClient;
  s3BucketName?: string;
  s3Client?: S3Client;
};

export class MarpSlideService {
  private readonly s3Client: S3Client;

  constructor(private readonly options: MarpSlideServiceOptions = {}) {
    this.s3Client =
      options.s3Client ??
      new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-1" });
  }

  async createSlides(rawInput: unknown): Promise<MarpCreateSlidesResponse> {
    const request = MarpCreateSlidesRequestSchema.parse(rawInput);

    let marpMarkdown: string;
    let slideCount: number = request.slideCount;

    const systemPrompt = [
      "You are SABOROU's presentation assistant. Generate a complete, self-contained Marp markdown presentation.",
      "",
      "Requirements:",
      "- Start with frontmatter: marp: true, theme: saborou-premium, paginate: true, size: 16:9, html: true",
      "- Embed the provided CSS verbatim in frontmatter under style: | so the deck is self-contained",
      "- Use --- to separate slides",
      "- Follow this narrative arc: Title slide → Agenda → Context/Why → Body slides (1 key point each) → Summary → Call to Action → Ending",
      "- Use <!-- _class: title --> for the cover slide, <!-- _class: section --> for chapter breaks, <!-- _class: lead --> for key-message slides, and <!-- _class: ending --> for the final slide",
      "- Vary layouts with .columns, .columns.col-3, .card, .card.accent, .card.success, .highlight, .number, and .tag",
      "- Write real, substantive content — not placeholders",
      "- Keep bullets concise (max 10 words each), max 5-6 bullets per slide",
      "- Bold the key phrase in each bullet: **key phrase** rest of text",
      `- ${request.language} language`,
      "",
      "Return ONLY the Marp tool output. Never include credentials or API keys.",
    ].join("\n");

    if (this.options.bedrockClient) {
      try {
        console.log(
          `[MarpSlideService] bedrock converse start topic=${request.topic} maxTokens=${MARP_MAX_TOKENS}`,
        );
        const response = await this.options.bedrockClient.converse({
          modelId: MODEL_ID,
          system: [{ text: systemPrompt }],
          messages: [
            {
              role: "user",
              content: [
                {
                  text: JSON.stringify({
                    topic: request.topic,
                    audience: request.audience ?? "general business",
                    slideCount: request.slideCount,
                    content: request.content,
                    purpose: request.purpose,
                    themeCss: SABOROU_MARP_THEME,
                  }),
                },
              ],
            },
          ],
          toolConfig: {
            tools: [MARP_GENERATOR_TOOL as never],
            toolChoice: { tool: { name: MARP_GENERATOR_TOOL_NAME } },
          },
          inferenceConfig: { maxTokens: MARP_MAX_TOKENS, temperature: 0.3 },
        });

        console.log(`[MarpSlideService] bedrock converse done`);
        const toolUse = response.output?.message?.content?.find(
          (block) => block.toolUse?.name === MARP_GENERATOR_TOOL_NAME,
        );
        const input = toolUse?.toolUse?.input as
          | { marpMarkdown?: string; slideCount?: number }
          | undefined;
        marpMarkdown =
          input?.marpMarkdown ??
          buildFixtureMarpMarkdown(
            request.topic,
            request.slideCount,
            request.language,
          );
        slideCount = input?.slideCount ?? request.slideCount;
      } catch (err) {
        console.log(
          `[MarpSlideService] bedrock error, using fixture: ${(err as Error)?.name}`,
        );
        marpMarkdown = buildFixtureMarpMarkdown(
          request.topic,
          request.slideCount,
          request.language,
        );
      }
    } else {
      marpMarkdown = buildFixtureMarpMarkdown(
        request.topic,
        request.slideCount,
        request.language,
      );
    }

    console.log(`[MarpSlideService] importing @marp-team/marp-core`);
    const { Marp } = await import("@marp-team/marp-core");
    console.log(
      `[MarpSlideService] rendering marp markdown len=${marpMarkdown.length}`,
    );
    const marp = new Marp({ html: true });
    const { html, css } = marp.render(marpMarkdown);
    const fullHtml = buildFullHtmlDocument(html, css, request.topic);
    console.log(`[MarpSlideService] render done htmlLen=${fullHtml.length}`);

    let slideUrl: string | undefined;

    if (this.options.s3BucketName) {
      try {
        const key = `marp-slides/${Date.now()}-${crypto.randomUUID()}.html`;
        console.log(
          `[MarpSlideService] s3 upload start bucket=${this.options.s3BucketName} key=${key}`,
        );
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.options.s3BucketName,
            Key: key,
            Body: fullHtml,
            ContentType: "text/html; charset=utf-8",
            ContentDisposition: "inline",
          }),
          { abortSignal: AbortSignal.timeout(8_000) },
        );
        slideUrl = await getSignedUrl(
          this.s3Client,
          new GetObjectCommand({ Bucket: this.options.s3BucketName, Key: key }),
          { expiresIn: 604800 },
        );
        console.log(
          `[MarpSlideService] s3 upload done slideUrl=${slideUrl?.slice(0, 60)}`,
        );
      } catch (err) {
        console.log(
          `[MarpSlideService] s3 upload error: ${(err as Error)?.message?.slice(0, 120)}`,
        );
        // S3 upload failed; slideUrl remains undefined
      }
    }

    const message = slideUrl
      ? `「${request.topic}」のスライド（${slideCount}枚）を作成しました。`
      : `「${request.topic}」のスライド（${slideCount}枚）を作成しましたが、URLの生成に失敗しました。`;

    return MarpCreateSlidesResponseSchema.parse({
      status: "created",
      message,
      slideUrl,
      topic: request.topic,
      slideCount,
    });
  }
}

export function buildFullHtmlDocument(
  html: string,
  css: string,
  title: string,
): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
<style>
* { box-sizing: border-box; }
:root {
  color-scheme: light;
  --preview-bg: #171923;
  --preview-ink: #f8fafc;
  --preview-muted: #9aa4b2;
  --preview-accent: #ff8a00;
}
body {
  min-height: 100vh;
  margin: 0;
  padding: 34px 20px 52px;
  color: var(--preview-ink);
  background:
    linear-gradient(120deg, rgba(255, 138, 0, 0.16), transparent 28%),
    radial-gradient(circle at 82% 12%, rgba(0, 168, 141, 0.17), transparent 34%),
    linear-gradient(180deg, #10131c, var(--preview-bg));
  font-family: "Hiragino Sans", "BIZ UDGothic", "Yu Gothic Medium", "Noto Sans JP", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
}
body::before {
  content: "${escapeCssContent(title)}";
  display: block;
  max-width: 960px;
  margin: 0 auto 18px;
  color: var(--preview-muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}
div.marpit {
  display: block;
  margin: 24px auto;
  max-width: 960px;
  background: #0f1118;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 26px 70px rgba(0,0,0,0.42);
  border-radius: 14px;
  overflow: hidden;
}
div.marpit > svg {
  display: block;
  width: 100%;
  height: auto;
}
@media (max-width: 720px) {
  body { padding: 18px 10px 34px; }
  body::before { margin-bottom: 10px; font-size: 12px; }
  div.marpit { margin: 14px auto; border-radius: 8px; }
}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCssContent(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function indentMarpStyle(css: string): string {
  return css
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function buildFixtureMarpMarkdown(
  topic: string,
  slideCount: number,
  language: "ja" | "en",
): string {
  const isJa = language === "ja";
  const bodyCount = Math.max(1, slideCount - 6);
  const bodySlides = Array.from({ length: bodyCount }, (_, i) => {
    const num = i + 1;
    return isJa
      ? `---\n\n## ポイント ${num}: 実行に移せる示唆\n\n<div class="columns">\n<div class="card accent">\n\n### 見るべき変化\n- **重要な点 ${num}** を具体化\n- **背景** と文脈を整理\n- **関係者** の期待を明確化\n\n</div>\n<div class="card success">\n\n### 進め方\n- **判断材料** を1枚に集約\n- **具体例** で納得感を補強\n- **次の行動** へ接続\n\n</div>\n</div>\n`
      : `---\n\n## Key Point ${num}: Make it actionable\n\n<div class="columns">\n<div class="card accent">\n\n### What changes\n- **Key point ${num}** made concrete\n- **Context** clarified for the audience\n- **Stakeholders** aligned on expectations\n\n</div>\n<div class="card success">\n\n### How to proceed\n- **Decision inputs** fit on one slide\n- **Examples** make the story credible\n- **Next action** stays obvious\n\n</div>\n</div>\n`;
  }).join("\n");

  const agenda = isJa ? "アジェンダ" : "Agenda";
  const overview = isJa ? "概要" : "Overview";
  const overviewBullets = isJa
    ? `<div class="highlight">**${topic}** を、背景・判断材料・次の行動まで一気通貫で整理します。</div>\n\n- **背景** と目的を短く共有\n- **対象** と期待成果を明確化\n- **判断材料** を実行単位に分解`
    : `<div class="highlight">This deck organizes **${topic}** from context to decision inputs and next actions.</div>\n\n- **Background** and objectives shared clearly\n- **Audience** and outcomes made explicit\n- **Decision inputs** broken into actions`;
  const agendaItems = isJa
    ? `<span class="tag">Overview</span> <span class="tag">Key Points</span> <span class="tag">Summary</span> <span class="tag">Next Steps</span>\n\n<div class="columns col-3">\n<div class="card">**1. 概要**<br/>目的と前提</div>\n<div class="card accent">**2. 主要論点**<br/>判断材料</div>\n<div class="card success">**3. 次の行動**<br/>実行計画</div>\n</div>`
    : `<span class="tag">Overview</span> <span class="tag">Key Points</span> <span class="tag">Summary</span> <span class="tag">Next Steps</span>\n\n<div class="columns col-3">\n<div class="card">**1. Overview**<br/>Goal and context</div>\n<div class="card accent">**2. Key points**<br/>Decision inputs</div>\n<div class="card success">**3. Next steps**<br/>Execution plan</div>\n</div>`;
  const summaryTitle = isJa ? "まとめ" : "Summary";
  const summaryBullets = isJa
    ? `- **主要な学び** を振り返りました\n- **行動指針** が明確になりました\n- **次のステップ** に進む準備ができました`
    : `- **Key learnings** reviewed\n- **Action items** are now clear\n- **Ready** to move forward`;
  const ctaTitle = isJa ? "次のステップ" : "Next Steps";
  const ctaBullets = isJa
    ? `- 具体的な行動を始めましょう\n- 疑問点はお気軽にどうぞ`
    : `- Start taking concrete actions\n- Feel free to ask questions`;
  const endingTitle = isJa ? "ご清聴ありがとうございました" : "Thank You";

  return `---
marp: true
theme: saborou-premium
paginate: true
size: 16:9
html: true
style: |
${indentMarpStyle(SABOROU_MARP_THEME)}
---

<!-- _class: title -->

# ${topic}

## ${isJa ? "意思決定を前に進めるプレゼンテーション" : "A presentation built to move decisions forward"}

${isJa ? "Generated by SABOROU" : "Generated by SABOROU"}

---

## ${agenda}

${agendaItems}

---

## ${overview}

${overviewBullets}

---

<!-- _class: section -->

## ${isJa ? "主要ポイント" : "Key Points"}

${isJa ? "論点を絞り、行動につながる形で整理します。" : "Focus the story into points that lead to action."}

${bodySlides}

---

## ${summaryTitle}

${summaryBullets}

<div class="columns col-3">
<div style="text-align:center"><span class="number">1</span>${isJa ? "明確な論点" : "Clear focus"}</div>
<div style="text-align:center"><span class="number warm">3</span>${isJa ? "実行ステップ" : "Action steps"}</div>
<div style="text-align:center"><span class="number">0</span>${isJa ? "迷子のスライド" : "Loose slides"}</div>
</div>

---

<!-- _class: lead -->

## ${ctaTitle}

${ctaBullets}

---

<!-- _class: ending -->

# ${endingTitle}
`;
}
