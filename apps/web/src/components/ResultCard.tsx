import type { Label } from "./ScoreBands";

const TITLE: Record<Label, string> = {
  not_cringe: "Clean & authentic",
  try_hard: "A tad try-hard",
  meh: "Kinda salesy / meh",
  cringe: "Cringe",
  wtf: "WTF – dial it back",
};

export function ResultCard({
  score,
  label,
  rationale,
  suggestion,
}: {
  score: number | null;
  label: Label | null;
  rationale?: string;
  suggestion?: string;
}) {
  if (score === null || !label) return null;
  return (
    <div className="result">
      <h3>
        {TITLE[label]} — {score}
      </h3>
      {rationale && <p>{rationale}</p>}
      {suggestion && (
        <p>
          <strong>Rewrite:</strong> {suggestion}
        </p>
      )}
    </div>
  );
}
