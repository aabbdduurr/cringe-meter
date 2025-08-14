import { useEffect, useMemo, useState } from "react";
import { ScoreBands, bandsForGauge, type Label } from "./components/ScoreBands";
import { ResultCard } from "./components/ResultCard";
import { Gauge } from "./components/Guage";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

type CringeResult = {
  score: number;
  label: Label;
  rationale?: string;
  suggestion?: string;
};

function labelFrom(score: number): Label {
  if (score < 20) return "not_cringe";
  if (score < 40) return "try_hard";
  if (score < 60) return "meh";
  if (score < 80) return "cringe";
  return "wtf";
}

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [result, setResult] = useState<CringeResult | null>(null);
  const activeLabel: Label | null = result?.label ?? null;

  // optional tiny "blip" after landing to feel lively
  const [blip, setBlip] = useState(false);
  useEffect(() => {
    if (!result) return;
    setBlip(true);
    const t = setTimeout(() => setBlip(false), 500);
    return () => clearTimeout(t);
  }, [result]);

  async function scoreNow() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error("Server error");
      const data = (await r.json()) as CringeResult;
      const s = Math.round(Number(data.score) || 0);
      const lbl = (data.label as Label) ?? labelFrom(s);
      setResult({
        score: s,
        label: lbl,
        rationale: data.rationale,
        suggestion: data.suggestion,
      });
      setDisplayScore(s);
    } catch {
      setResult({
        score: 0,
        label: "meh",
        rationale: "Server unreachable",
        suggestion: "",
      });
      setDisplayScore(0);
    } finally {
      setLoading(false);
    }
  }

  const placeholder = useMemo(
    () =>
      `Paste a LinkedIn post, then hit “Is this cringe?”. We’ll sweep the dial and land on a band with a short reason and a cleaner rewrite.`,
    []
  );

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Cringe Meter</h1>
          <p>
            Is your LinkedIn post <em>cringe-worthy</em>?
          </p>
        </div>

        <div className="grid">
          <div>
            <Gauge
              value={blip ? Math.min(100, displayScore + 10) : displayScore}
              bands={bandsForGauge}
              loading={loading}
              onSweepDone={() => {}}
            />
            <ScoreBands active={activeLabel} />
          </div>

          <div className="textbox">
            <textarea
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="actions">
              <button
                className="btn"
                onClick={scoreNow}
                disabled={loading || !text.trim()}
              >
                {loading ? <span className="spinner" /> : null}
                <span>{loading ? "Scoring…" : "Is this cringe?"}</span>
              </button>
            </div>
            <ResultCard
              score={result?.score ?? null}
              label={result?.label ?? null}
              rationale={result?.rationale}
              suggestion={result?.suggestion}
            />
            <div className="mini">
              The needle does a startup sweep like a car tachometer, for fun.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
