import { useEffect, useRef, useState } from "react";

type Band = { from: number; to: number; color: string; label: string };

// 0..100 → top semicircle (0°=right, 180°=left)
const angleFor = (v: number) => 180 - Math.max(0, Math.min(100, v)) * 1.8;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function polar(cx: number, cy: number, r: number, deg: number) {
  // draw up (screen y grows down)
  const rad = toRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const seg = (from: number, to: number) => {
    const p0 = polar(cx, cy, r, from),
      p1 = polar(cx, cy, r, to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
  };
  let d = "",
    s = a0,
    e = a1;
  while (Math.abs(e - s) > 180) {
    const mid = s + Math.sign(e - s) * 180;
    d += (d ? " " : "") + seg(s, mid);
    s = mid;
  }
  d += (d ? " " : "") + seg(s, e);
  return d;
}

export function Gauge({
  value,
  bands,
  loading,
  onSweepDone,
}: {
  value: number;
  bands: readonly Band[];
  loading?: boolean;
  onSweepDone?: () => void;
}) {
  // generous box
  const VB_W = 400,
    VB_H = 280;
  const cx = VB_W / 2,
    cy = VB_H * 0.97,
    r = Math.min(VB_W, VB_H * 1.85) / 2;

  const [needle, _setNeedle] = useState(0);
  const needleRef = useRef(0); // <-- source of truth for current value
  const sweepDone = useRef(false);
  const raf = useRef<number | null>(null);

  // keep ref in sync with state
  const setNeedle = (n: number) => {
    needleRef.current = n;
    _setNeedle(n);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await animateTo(100, 700); // up
      await animateTo(0, 650); // and BACK smoothly
      if (!mounted) return;
      sweepDone.current = true;
      onSweepDone?.();
    })();
    return () => {
      mounted = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only follow external value after the sweep
  useEffect(() => {
    if (!sweepDone.current) return;
    animateTo(value, 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function animateTo(target: number, duration = 600) {
    // READ the actual current value, not a stale closure
    const from = needleRef.current;
    // cancel any in-flight animation to avoid overlap
    if (raf.current) cancelAnimationFrame(raf.current);

    const start = performance.now();
    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setNeedle(lerp(from, target, easeOut(t)));
        if (t < 1) raf.current = requestAnimationFrame(tick);
        else resolve();
      };
      raf.current = requestAnimationFrame(tick);
    });
  }

  const majors = [0, 20, 40, 60, 80, 100];
  const tip = polar(cx, cy, r - 26, angleFor(needle));

  return (
    <div className="gaugeWrap">
      <svg
        className="gauge"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        aria-label="cringe meter"
      >
        <path
          d={arcPath(cx, cy, r, angleFor(100), angleFor(0))}
          stroke="#16202b"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />
        {bands.map((b, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, angleFor(b.to), angleFor(b.from))}
            stroke={b.color}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {majors.map((t, i) => {
          const ang = angleFor(t);
          const p0 = polar(cx, cy, r - 6, ang);
          const p1 = polar(cx, cy, r - 22, ang);
          const pn = polar(cx, cy, r - 40, ang);
          return (
            <g key={i}>
              <line
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke="#334155"
                strokeWidth="1.5"
              />
              <text
                x={pn.x}
                y={pn.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#7c8796"
                fontSize="14"
              >
                {t}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2f8fb" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y + 0.1}
          stroke="url(#needleGrad)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill="#0a131b"
          stroke="#22d3ee"
          strokeWidth="2"
        />
      </svg>

      <div className="scoreBig">{Math.round(needle)}</div>
      <div className={`gaugeOverlay ${loading ? "show" : ""}`}>
        <div className="spinnerLg" />
      </div>
    </div>
  );
}
