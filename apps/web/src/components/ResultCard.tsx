import { useEffect, useState } from "react";
import type { Label } from "./ScoreBands";

const TITLE: Record<Label, string> = {
  not_cringe: "Clean & authentic",
  try_hard: "Not too bad",
  meh: "Kinda salesy / meh",
  cringe: "Cringe",
  wtf: "WTF – dial it back",
};

const COLOR: Record<Label, string> = {
  not_cringe: "#22c55e",
  try_hard: "#84cc16",
  meh: "#f59e0b",
  cringe: "#f97316",
  wtf: "#ef4444",
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

  const [tab, setTab] = useState<"reason" | "rewrite">("reason");
  const color = COLOR[label];

  // Whenever a new result arrives, default to Reason (or Rewrite if that’s the only content)
  useEffect(() => {
    if (suggestion?.trim()) setTab("reason");
    else setTab("reason");
  }, [label, score, suggestion]);

  const hasRewrite = Boolean(suggestion && suggestion.trim());

  return (
    <div className="result">
      <div className="resultHeader" style={{ borderColor: color }}>
        <h3>
          {TITLE[label]} — {score}
        </h3>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${tab === "reason" ? "active" : ""}`}
          style={tab === "reason" ? { borderColor: color, color: "#fff" } : {}}
          onClick={() => setTab("reason")}
          type="button"
        >
          Reason
        </button>
        {hasRewrite && (
          <button
            className={`tab ${tab === "rewrite" ? "active" : ""}`}
            style={
              tab === "rewrite" ? { borderColor: color, color: "#fff" } : {}
            }
            onClick={() => setTab("rewrite")}
            type="button"
          >
            Suggested rewrite
          </button>
        )}
      </div>

      {/* Panels */}
      {tab === "reason" && (
        <div className="panel">
          <p className="reason">{rationale || "No rationale provided."}</p>
        </div>
      )}
      {tab === "rewrite" && hasRewrite && (
        <div className="panel">
          <p className="rewrite">{suggestion}</p>
        </div>
      )}
    </div>
  );
}
