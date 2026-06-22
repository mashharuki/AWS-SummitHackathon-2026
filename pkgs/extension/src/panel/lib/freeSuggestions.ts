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
        description: "1本まるごと観られる時間があります",
        url: "https://www.amazon.co.jp/gp/video/storefront",
        service: "Amazon Prime Video",
      },
      {
        label: "Kindle で読書",
        description: "集中して本を読むのに最適な時間です",
        url: "https://read.amazon.co.jp",
        service: "Kindle",
      },
      {
        label: "趣味リサーチ",
        description: "気になることをじっくり調べましょう",
        url: "https://www.amazon.co.jp",
        service: "Amazon EC",
      },
    ];
  }
  if (freeMinutes >= 30) {
    return [
      {
        label: "Audible で短編",
        description: "30分以内で聴けるポッドキャストや朗読があります",
        url: "https://www.audible.co.jp",
        service: "Amazon Audible",
      },
      {
        label: "Prime Video でドラマ1話",
        description: "短編コンテンツをチェックしましょう",
        url: "https://www.amazon.co.jp/gp/video/storefront",
        service: "Amazon Prime Video",
      },
    ];
  }
  if (freeMinutes >= 15) {
    return [
      {
        label: "Prime Reading でマンガ1話",
        description: "15分でサクッと読めます",
        url: "https://www.amazon.co.jp/kindle-dbs/fd/prime-reading",
        service: "Amazon Prime Reading",
      },
      {
        label: "Amazon Music で音楽",
        description: "好きな音楽を流してリフレッシュ",
        url: "https://music.amazon.co.jp",
        service: "Amazon Music",
      },
    ];
  }
  if (freeMinutes >= 5) {
    return [
      {
        label: "Amazon Music でひと息",
        description: "5分だけ音楽を聴いてリセット",
        url: "https://music.amazon.co.jp",
        service: "Amazon Music",
      },
      {
        label: "Prime Video (無料) でリフレッシュ",
        description: "5分のコンテンツで集中力を回復",
        url: "https://www.amazon.co.jp/gp/video/storefront?filterId=OFFER_BINDING_TYPE%3AFREE",
        service: "Amazon Prime Video",
      },
    ];
  }
  return [
    {
      label: "Amazon Music でひと息",
      description: "短い時間でも音楽でリフレッシュできます",
      url: "https://music.amazon.co.jp",
      service: "Amazon Music",
    },
  ];
}
