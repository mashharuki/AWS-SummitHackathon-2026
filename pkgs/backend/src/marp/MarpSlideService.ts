import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Marp } from "@marp-team/marp-core";
import type { IBedrockClient } from "@saboru/agent";
import {
  MarpCreateSlidesRequestSchema,
  MarpCreateSlidesResponseSchema,
  type MarpCreateSlidesResponse,
} from "./schemas.js";

const MODEL_ID = "jp.anthropic.claude-sonnet-4-6";
const MARP_GENERATOR_TOOL_NAME = "generate_marp_slides";

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
      "- Start with frontmatter: marp: true, theme: default, paginate: true, size: 16:9, html: true",
      "- Use --- to separate slides",
      "- Follow this narrative arc: Title slide → Agenda → Context/Why → Body slides (1 key point each) → Summary → Call to Action → Ending",
      "- Use <!-- _class: lead --> for title and section break slides",
      "- Write real, substantive content — not placeholders",
      "- Keep bullets concise (max 10 words each), max 5-6 bullets per slide",
      "- Bold the key phrase in each bullet: **key phrase** rest of text",
      `- ${request.language} language`,
      "",
      "Return ONLY the Marp tool output. Never include credentials or API keys.",
    ].join("\n");

    if (this.options.bedrockClient) {
      try {
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
                  }),
                },
              ],
            },
          ],
          toolConfig: {
            tools: [MARP_GENERATOR_TOOL as never],
            toolChoice: { tool: { name: MARP_GENERATOR_TOOL_NAME } },
          },
          inferenceConfig: { maxTokens: 4000, temperature: 0.3 },
        });

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
      } catch {
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

    const marp = new Marp({ html: true });
    const { html, css } = marp.render(marpMarkdown);
    const fullHtml = buildFullHtmlDocument(html, css, request.topic);

    let slideUrl: string | undefined;

    if (this.options.s3BucketName) {
      try {
        const key = `marp-slides/${Date.now()}-${crypto.randomUUID()}.html`;
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.options.s3BucketName,
            Key: key,
            Body: fullHtml,
            ContentType: "text/html; charset=utf-8",
            ContentDisposition: "inline",
          }),
        );
        slideUrl = await getSignedUrl(
          this.s3Client,
          new GetObjectCommand({ Bucket: this.options.s3BucketName, Key: key }),
          { expiresIn: 604800 },
        );
      } catch {
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

function buildFullHtmlDocument(
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
body { margin: 0; background: #1a1a2e; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
section.marpit { box-shadow: 0 8px 32px rgba(0,0,0,0.4); margin: 20px auto; }
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
      ? `---\n\n## ポイント ${num}\n\n- **重要な点 ${num}** についての説明\n- **背景** と文脈の整理\n- **具体例** を交えた解説\n`
      : `---\n\n## Key Point ${num}\n\n- **Important aspect ${num}** explained\n- **Background** and context\n- **Example** with concrete details\n`;
  }).join("\n");

  const agenda = isJa ? "アジェンダ" : "Agenda";
  const overview = isJa ? "概要" : "Overview";
  const overviewBullets = isJa
    ? `- **${topic}** について説明します\n- **背景** と目的を整理します\n- **対象** と期待成果を明確にします`
    : `- **${topic}** introduction\n- **Background** and objectives\n- **Target audience** and expected outcomes`;
  const agendaItems = isJa
    ? `- 概要\n- 主要なポイント\n- まとめ\n- 次のステップ`
    : `- Overview\n- Key Points\n- Summary\n- Next Steps`;
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
theme: default
paginate: true
size: 16:9
html: true
---

<!-- _class: lead -->

# ${topic}

${isJa ? "プレゼンテーション" : "Presentation"}

---

## ${agenda}

${agendaItems}

---

## ${overview}

${overviewBullets}

${bodySlides}

---

## ${summaryTitle}

${summaryBullets}

---

<!-- _class: lead -->

## ${ctaTitle}

${ctaBullets}

---

<!-- _class: lead -->

# ${endingTitle}
`;
}
