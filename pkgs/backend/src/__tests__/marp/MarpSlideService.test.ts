import { describe, expect, it } from "vitest";
import {
  MarpSlideService,
  buildFullHtmlDocument,
} from "../../marp/MarpSlideService.js";

describe("MarpSlideService", () => {
  it("creates styled fixture slides without Bedrock", async () => {
    const service = new MarpSlideService();

    const response = await service.createSlides({
      topic: "AWS Summit Hackathon",
      slideCount: 8,
      language: "ja",
      audience: "hackathon judges",
      purpose: "pitch",
    });

    expect(response).toMatchObject({
      status: "created",
      topic: "AWS Summit Hackathon",
      slideCount: 8,
    });
    expect(response.slideUrl).toBeUndefined();
    expect(response.message).toContain("AWS Summit Hackathon");
  });

  it("wraps rendered Marp output with the premium preview shell", () => {
    const html = buildFullHtmlDocument(
      '<div class="marpit"><svg></svg></div>',
      "section { color: red; }",
      "Premium Deck",
    );

    expect(html).toContain("section { color: red; }");
    expect(html).toContain("--preview-bg");
    expect(html).toContain("radial-gradient");
    expect(html).toContain('<div class="marpit"><svg></svg></div>');
  });

  it("escapes the document title in title and preview CSS content", () => {
    const html = buildFullHtmlDocument(
      '<div class="marpit"><svg></svg></div>',
      "",
      'Bad <script>alert("x")</script> Title',
    );

    expect(html).toContain(
      "<title>Bad &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Title</title>",
    );
    expect(html).toContain(
      'content: "Bad <script>alert(\\"x\\")</script> Title"',
    );
    expect(html).not.toContain("<title>Bad <script>");
  });
});
