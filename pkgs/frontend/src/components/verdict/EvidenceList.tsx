/**
 * EvidenceList — reasoning の string[] を箇条書き表示
 * U-06-ui-redesign Phase 5 改修版（ネオブルータリズム）
 *
 * API の reasoning は string[] なので、HTML の構造化 reason は
 * フロント側で吸収せず、シンプルに行リストで表示する（GAP-02 対応）。
 */

interface EvidenceListProps {
  items: string[];
  title?: string;
}

export function EvidenceList({
  items,
  title = "サボろうの根拠",
}: EvidenceListProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="evidence-title" className="card-brutal p-3.5">
      <h3
        id="evidence-title"
        className="text-saboru-ink-soft font-bold mb-2"
        style={{ fontSize: 10, letterSpacing: "0.1em" }}
      >
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5" role="list">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-saboru-ink"
            style={{ fontSize: 12, lineHeight: 1.5 }}
          >
            <span
              className="mt-1.5 flex-shrink-0"
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "#F97316",
              }}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
