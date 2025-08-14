export type Label = "not_cringe" | "try_hard" | "meh" | "cringe" | "wtf";

const COLORS: Record<Label, string> = {
  not_cringe: "#22c55e",
  try_hard: "#84cc16",
  meh: "#f59e0b",
  cringe: "#f97316",
  wtf: "#ef4444",
};
const TITLES: Record<Label, string> = {
  not_cringe: "Authentic",
  try_hard: "Not Bad",
  meh: "Salesy",
  cringe: "Cringe",
  wtf: "WTF",
};

export function ScoreBands({ active }: { active: Label | null }) {
  const order: Label[] = ["not_cringe", "try_hard", "meh", "cringe", "wtf"];
  return (
    <div className="bands">
      {order.map((l) => (
        <div
          key={l}
          className={`band ${active === l ? "active" : ""}`}
          style={{ color: active === l ? COLORS[l] : undefined }}
        >
          <span className="dot" style={{ background: COLORS[l] }} />
          <span>{TITLES[l]}</span>
        </div>
      ))}
    </div>
  );
}

export const bandsForGauge = [
  { from: 0, to: 20, color: "#22c55e", label: "not_cringe" },
  { from: 20, to: 40, color: "#84cc16", label: "try_hard" },
  { from: 40, to: 60, color: "#f59e0b", label: "meh" },
  { from: 60, to: 80, color: "#f97316", label: "cringe" },
  { from: 80, to: 100, color: "#ef4444", label: "wtf" },
] as const;
