/**
 * freeSuggestions.ts — 余白時間に応じたAmazonサービス提案リスト
 *
 * 余白分数に応じて段階的な提案を返す。HomeTab と SlackTab で共用。
 */

export interface FreeSuggestion {
  label: string;
  description: string;
  url: string;
  service: string;
}

export function getSuggestions(freeMinutes: number): FreeSuggestion[] {
  if (freeMinutes >= 60) {
    return [
      {
        label: "Prime Video で映画",
        description: "1本まるごといけるぞ。罪悪感はサボローが持っとく",
        url: "https://www.amazon.co.jp/gp/video/storefront",
        service: "Amazon Prime Video",
      },
      {
        label: "Kindle で読書",
        description: "ここは堂々と読書時間にしよう。守った余白だから",
        url: "https://read.amazon.co.jp",
        service: "Kindle",
      },
      {
        label: "趣味リサーチ",
        description: "気になるもの、見に行っちゃえ。今日はそこまで働いた",
        url: "https://www.amazon.co.jp",
        service: "Amazon EC",
      },
    ];
  }
  if (freeMinutes >= 30) {
    return [
      {
        label: "Audible で短編",
        description: "耳だけ預けて休もっか。手は止めて大丈夫",
        url: "https://www.audible.co.jp",
        service: "Amazon Audible",
      },
      {
        label: "Prime Video でドラマ1話",
        description: "1話だけ観ちゃえ観ちゃえ。戻る時間はサボローが見てる",
        url: "https://www.amazon.co.jp/gp/video/storefront",
        service: "Amazon Prime Video",
      },
    ];
  }
  if (freeMinutes >= 15) {
    return [
      {
        label: "Prime Reading でマンガ1話",
        description: "15分だけ肩の力抜こっか。マンガ1話ならちょうどいい",
        url: "https://www.amazon.co.jp/kindle-dbs/fd/prime-reading",
        service: "Amazon Prime Reading",
      },
      {
        label: "Amazon Music で音楽",
        description: "好きな曲を流そ。今の余白はちゃんと休んでいいやつ",
        url: "https://music.amazon.co.jp",
        service: "Amazon Music",
      },
    ];
  }
  if (freeMinutes >= 5) {
    return [
      {
        label: "Amazon Music でひと息",
        description: "5分だけ目を離そっか。ここはサボローが見張っとく",
        url: "https://music.amazon.co.jp",
        service: "Amazon Music",
      },
      {
        label: "Prime Video (無料) でリフレッシュ",
        description: "短いやつで一回リセット。戻る時はちゃんと声かける",
        url: "https://www.amazon.co.jp/gp/video/storefront?filterId=OFFER_BINDING_TYPE%3AFREE",
        service: "Amazon Prime Video",
      },
    ];
  }
  return [
    {
      label: "Amazon Music でひと息",
      description: "短くても余白は余白。1曲だけ聴いて肩の力抜こっか",
      url: "https://music.amazon.co.jp",
      service: "Amazon Music",
    },
  ];
}
