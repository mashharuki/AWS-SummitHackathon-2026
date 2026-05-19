/**
 * 根拠箇条書きリスト
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
    <section aria-labelledby="evidence-title" className="mt-3">
      <h3
        id="evidence-title"
        className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2"
      >
        {title}
      </h3>
      <ul className="space-y-1" role="list">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#1A1A1A]">
            <span
              className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#FF6B2B] shrink-0"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
