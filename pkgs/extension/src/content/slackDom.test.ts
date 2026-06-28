/**
 * slackDom.test.ts — Slack DOM ユーティリティのユニットテスト
 *
 * jsdom 環境で DOM 要素を組み立てて純粋ロジックをテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clickSendButton,
  extractChannelIdFromUrl,
  extractMessageData,
  extractThreadTs,
  isChannelUrl,
  isDmUrl,
  isMentionedToMe,
  isSelfMessage,
  typeIntoSlackInput,
} from "./slackDom";

// ---------------------------------------------------------------------------
// Helpers: DOM 要素ビルダー
// ---------------------------------------------------------------------------

/** メッセージコンテナ要素を組み立てる */
function buildMessageContainer({
  text = "テストメッセージ",
  senderName = "テストユーザー",
  senderId = "",
  threadTs = "1234567890.123456",
  channelId = "",
  mentionUids = [] as string[],
  isSentByMe = false,
}: {
  text?: string;
  senderName?: string;
  senderId?: string;
  threadTs?: string;
  channelId?: string;
  mentionUids?: string[];
  isSentByMe?: boolean;
} = {}): Element {
  const container = document.createElement("div");
  container.setAttribute("data-qa", "message_container");
  // 実機 Slack の属性（data-msg-ts / data-msg-channel-id）を最優先で設定する
  if (threadTs) container.setAttribute("data-msg-ts", threadTs);
  if (channelId) container.setAttribute("data-msg-channel-id", channelId);
  if (isSentByMe) container.classList.add("c-message--sent-by-me");

  const senderEl = document.createElement("span");
  senderEl.setAttribute("data-qa", "message_sender_name");
  senderEl.textContent = senderName;
  if (senderId) senderEl.setAttribute("data-user-id", senderId);
  container.appendChild(senderEl);

  const textEl = document.createElement("div");
  textEl.setAttribute("data-qa", "message_text");
  textEl.textContent = text;

  // @mention 要素を追加（実機は data-stringify-mention に user ID を持つ）
  // data-stringify-type="mention" と .c-mrkdwn__mention クラスの両方を付与する
  for (const uid of mentionUids) {
    const mention = document.createElement("span");
    mention.setAttribute("data-stringify-type", "mention");
    mention.classList.add("c-mrkdwn__mention");
    mention.setAttribute("data-stringify-mention", uid);
    mention.setAttribute("data-user-id", uid);
    mention.textContent = `@${uid}`;
    textEl.appendChild(mention);
  }

  container.appendChild(textEl);

  return container;
}

/** Slack メッセージ入力フィールドを含む document を返す */
function buildDocWithInput(
  selector: string,
  extraAttrs: Record<string, string> = {},
): { doc: Document; input: HTMLElement } {
  const doc = document.implementation.createHTMLDocument("test");
  const input = doc.createElement("div");
  input.contentEditable = "true";
  // data-qa 属性でセレクタを合わせる
  const [, attr, val] = selector.match(/\[([^=]+)="([^"]+)"\]/) ?? [];
  if (attr && val) input.setAttribute(attr, val);
  for (const [k, v] of Object.entries(extraAttrs)) {
    input.setAttribute(k, v);
  }
  doc.body.appendChild(input);
  return { doc, input };
}

// ---------------------------------------------------------------------------
// isDmUrl
// ---------------------------------------------------------------------------

describe("isDmUrl", () => {
  it("DM チャンネル URL を正しく判定する", () => {
    expect(isDmUrl("/client/T0TEAM/D1234567890")).toBe(true);
    expect(isDmUrl("/client/T0TEAM/DABC123")).toBe(true);
  });

  it("チャンネル URL は false を返す", () => {
    expect(isDmUrl("/client/T0TEAM/C1234567890")).toBe(false);
  });

  it("その他の URL は false を返す", () => {
    expect(isDmUrl("/")).toBe(false);
    expect(isDmUrl("/messages/")).toBe(false);
    expect(isDmUrl("/client/T0TEAM/G1234567890")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isChannelUrl
// ---------------------------------------------------------------------------

describe("isChannelUrl", () => {
  it("チャンネル URL を正しく判定する", () => {
    expect(isChannelUrl("/client/T0TEAM/C1234567890")).toBe(true);
    expect(isChannelUrl("/client/T0TEAM/CABC123")).toBe(true);
  });

  it("DM URL は false を返す", () => {
    expect(isChannelUrl("/client/T0TEAM/D1234567890")).toBe(false);
  });

  it("その他の URL は false を返す", () => {
    expect(isChannelUrl("/")).toBe(false);
    expect(isChannelUrl("/messages/")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractChannelIdFromUrl
// ---------------------------------------------------------------------------

describe("extractChannelIdFromUrl", () => {
  it("DM チャンネル ID を抽出する", () => {
    expect(extractChannelIdFromUrl("/client/T0TEAM/D1234567890")).toBe(
      "D1234567890",
    );
  });

  it("チャンネル ID を抽出する", () => {
    expect(extractChannelIdFromUrl("/client/T0TEAM/C9999999999")).toBe(
      "C9999999999",
    );
  });

  it("マッチしない場合は null を返す", () => {
    expect(extractChannelIdFromUrl("/")).toBeNull();
    expect(extractChannelIdFromUrl("/messages/")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSelfMessage
// ---------------------------------------------------------------------------

describe("isSelfMessage", () => {
  it("data-user-id が自分の ID と一致する場合 true を返す", () => {
    const el = buildMessageContainer({ senderId: "U_ME" });
    expect(isSelfMessage(el, "U_ME")).toBe(true);
  });

  it("data-user-id が異なる場合 false を返す", () => {
    const el = buildMessageContainer({ senderId: "U_OTHER" });
    expect(isSelfMessage(el, "U_ME")).toBe(false);
  });

  it("c-message--sent-by-me クラスがある場合 true を返す", () => {
    const el = buildMessageContainer({ isSentByMe: true });
    expect(isSelfMessage(el, "U_ME")).toBe(true);
  });

  it("送信者 ID もクラスもない場合 false を返す", () => {
    const el = buildMessageContainer();
    expect(isSelfMessage(el, "U_ME")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isMentionedToMe
// ---------------------------------------------------------------------------

describe("isMentionedToMe", () => {
  it("DM URL の場合: 他人からのメッセージを自分宛てと判定する", () => {
    const el = buildMessageContainer({ senderId: "U_OTHER" });
    expect(isMentionedToMe(el, "/client/T0TEAM/D1234567890", "U_ME")).toBe(
      true,
    );
  });

  it("DM URL の場合: 自分が送ったメッセージは false を返す", () => {
    const el = buildMessageContainer({ senderId: "U_ME" });
    expect(isMentionedToMe(el, "/client/T0TEAM/D1234567890", "U_ME")).toBe(
      false,
    );
  });

  it("DM URL の場合: mySlackUserId が未指定なら true を返す", () => {
    const el = buildMessageContainer();
    expect(isMentionedToMe(el, "/client/T0TEAM/D1234567890")).toBe(true);
  });

  it("チャンネル URL + @mention が自分宛ての場合 true を返す", () => {
    const el = buildMessageContainer({ mentionUids: ["U_ME"] });
    expect(isMentionedToMe(el, "/client/T0TEAM/C1234567890", "U_ME")).toBe(
      true,
    );
  });

  it("チャンネル URL + @mention が他人宛ての場合 false を返す", () => {
    const el = buildMessageContainer({ mentionUids: ["U_OTHER"] });
    expect(isMentionedToMe(el, "/client/T0TEAM/C1234567890", "U_ME")).toBe(
      false,
    );
  });

  it("チャンネル URL + @mention なしの場合 false を返す", () => {
    const el = buildMessageContainer();
    expect(isMentionedToMe(el, "/client/T0TEAM/C1234567890", "U_ME")).toBe(
      false,
    );
  });

  it("その他の URL の場合 false を返す", () => {
    const el = buildMessageContainer({ mentionUids: ["U_ME"] });
    expect(isMentionedToMe(el, "/", "U_ME")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractMessageData
// ---------------------------------------------------------------------------

describe("extractMessageData", () => {
  it("DM チャンネルのメッセージデータを正しく抽出する", () => {
    const el = buildMessageContainer({
      text: "おつかれさまです",
      senderName: "田中太郎",
      threadTs: "1717900000.111111",
    });

    const data = extractMessageData(el, "/client/T0TEAM/D1234567890");

    expect(data).not.toBeNull();
    expect(data?.text).toBe("おつかれさまです");
    expect(data?.sender).toBe("田中太郎");
    expect(data?.channelId).toBe("D1234567890");
    expect(data?.threadTs).toBe("1717900000.111111");
  });

  it("チャンネル ID が取得できない場合は null を返す", () => {
    const el = buildMessageContainer();
    const data = extractMessageData(el, "/");
    expect(data).toBeNull();
  });

  it("テキストが空の場合でも抽出できる", () => {
    const el = buildMessageContainer({ text: "" });
    const data = extractMessageData(el, "/client/T0TEAM/C1234567890");
    expect(data?.text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractThreadTs
// ---------------------------------------------------------------------------

describe("extractThreadTs", () => {
  it("data-ts 属性からタイムスタンプを取得する", () => {
    const el = document.createElement("div");
    el.setAttribute("data-ts", "1717900000.111111");
    expect(extractThreadTs(el)).toBe("1717900000.111111");
  });

  it("data-ts がない場合は空文字を返す", () => {
    const el = document.createElement("div");
    expect(extractThreadTs(el)).toBe("");
  });

  it("archives URL からタイムスタンプを抽出する", () => {
    const el = document.createElement("div");
    const link = document.createElement("a");
    link.setAttribute("href", "/archives/C1234567890/p1717900000111111");
    el.appendChild(link);
    expect(extractThreadTs(el)).toBe("1717900000.111111");
  });
});

// ---------------------------------------------------------------------------
// typeIntoSlackInput
// ---------------------------------------------------------------------------

describe("typeIntoSlackInput", () => {
  const execCommandMock = vi.fn().mockReturnValue(false);

  beforeEach(() => {
    // jsdom では execCommand が未定義のため Object.defineProperty で追加する
    Object.defineProperty(document, "execCommand", {
      value: execCommandMock,
      writable: true,
      configurable: true,
    });
    execCommandMock.mockReset();
    execCommandMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("メッセージ入力フィールドが見つからない場合はエラーをスローする", () => {
    const doc = document.implementation.createHTMLDocument("empty");
    // 別 document には execCommand が未定義のため dispatchEvent フォールバックが動く
    // 入力フィールドがない場合はエラー
    expect(() => typeIntoSlackInput("テスト", doc)).toThrow(
      "Slack input field not found",
    );
  });

  it("texty_input セレクタの入力フィールドに dispatchEvent が呼ばれる", () => {
    const { doc, input } = buildDocWithInput('[data-qa="texty_input"]');
    const dispatchEventSpy = vi.spyOn(input, "dispatchEvent");

    // doc を使うので execCommand は doc.execCommand を呼ぶ（未定義 → フォールバック）
    typeIntoSlackInput("こんにちは", doc);

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as InputEvent;
    expect(event.type).toBe("input");
    expect(event.bubbles).toBe(true);
  });

  it("message_input セレクタの入力フィールドにフォールバックする", () => {
    const { doc, input } = buildDocWithInput('[data-qa="message_input"]');
    const dispatchEventSpy = vi.spyOn(input, "dispatchEvent");

    typeIntoSlackInput("フォールバックテスト", doc);

    expect(dispatchEventSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clickSendButton
// ---------------------------------------------------------------------------

describe("clickSendButton", () => {
  it("送信ボタンが見つからない場合はエラーをスローする", () => {
    const doc = document.implementation.createHTMLDocument("empty");
    expect(() => clickSendButton(doc)).toThrow("Slack send button not found");
  });

  it("texty_send_button に MouseEvent が dispatch される", () => {
    const doc = document.implementation.createHTMLDocument("test");
    const btn = doc.createElement("button");
    btn.setAttribute("data-qa", "texty_send_button");
    doc.body.appendChild(btn);

    const dispatchEventSpy = vi.spyOn(btn, "dispatchEvent");

    clickSendButton(doc);

    expect(dispatchEventSpy).toHaveBeenCalledOnce();
    const event = dispatchEventSpy.mock.calls[0][0] as MouseEvent;
    expect(event.type).toBe("click");
    expect(event.bubbles).toBe(true);
  });

  it("send_in_thread_button が優先される", () => {
    const doc = document.implementation.createHTMLDocument("test");
    const threadBtn = doc.createElement("button");
    threadBtn.setAttribute("data-qa", "send_in_thread_button");
    const mainBtn = doc.createElement("button");
    mainBtn.setAttribute("data-qa", "texty_send_button");
    doc.body.appendChild(threadBtn);
    doc.body.appendChild(mainBtn);

    const threadSpy = vi.spyOn(threadBtn, "dispatchEvent");
    const mainSpy = vi.spyOn(mainBtn, "dispatchEvent");

    clickSendButton(doc);

    expect(threadSpy).toHaveBeenCalledOnce();
    expect(mainSpy).not.toHaveBeenCalled();
  });
});
