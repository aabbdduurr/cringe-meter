// content.ts
type ScorePayload = { text: string };
type ScoreResult = {
  score: number;
  label: string;
  rationale?: string;
  suggestion?: string;
};

const IS_LI = location.hostname.includes("linkedin.com");
if (!IS_LI) {
  /* safety */
}

// Be liberal in what we match, strict in what we accept.
const POST_CANDIDATES = [
  // canonical
  'article[data-urn*="activity:" i]',
  'article[data-urn*="ugcpost:" i]',
  // some variants nest data-urn inside the article
  'article:has([data-urn*="activity:" i])',
  'article:has([data-urn*="ugcpost:" i])',
  // fallback: div containers LinkedIn sometimes uses
  'div[data-urn*="activity:" i]',
  'div[data-urn*="ugcpost:" i]',
].join(",");

// UI bits
const SPINNER_HTML = `<span class="cm-dot cm-spin"></span><span> Scoring…</span>`;
const ERROR_HTML = `<span class="cm-dot cm-red"></span><span> ERR</span>`;

// --- text extraction ---------------------------------------------------------
function findPostText(el: Element): string {
  const candidates = [
    '[data-test-id="post-content"]',
    "div.update-components-text",
    "div.feed-shared-inline-show-more-text",
    "div.feed-shared-update-v2__description-wrapper",
    "div.feed-shared-text__text-view",
    'span[dir="ltr"]',
    // fallback
    ".update-components-text, .break-words",
  ];
  for (const sel of candidates) {
    const n = (el as HTMLElement).querySelector(sel);
    if (n && n.textContent && n.textContent.trim().length > 0) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t.length > 20) return t.slice(0, 4000);
    }
  }
  // last resort
  const t = (el.textContent || "").replace(/\s+/g, " ").trim();
  return t.slice(0, 4000);
}

function normalizeContainer(node: Element): HTMLElement | null {
  // prefer the article if present, else the data-urn element
  const article = node.closest("article");
  const container = (article ||
    node.closest("[data-urn]") ||
    node) as HTMLElement;
  // ensure a positioning context for absolute badge
  const cs = getComputedStyle(container);
  if (cs.position === "static") container.style.position = "relative";
  return container;
}

function looksLikePost(node: Element): boolean {
  // reject obvious non-posts
  const text = findPostText(node);
  if (text.length < 20) return false;
  // skip promos/sponsored
  const s = node.textContent || "";
  if (/Promoted|Sponsored/i.test(s)) return false;
  return true;
}

// --- badge helpers -----------------------------------------------------------
function ensureBadge(container: HTMLElement): HTMLElement {
  let badge = container.querySelector<HTMLElement>(".cm-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "cm-badge";
    badge.innerHTML = `<span class="cm-dot"></span><span> Score</span>`;
    container.appendChild(badge);
  }
  return badge;
}

function setBadgeLoading(badge: HTMLElement) {
  badge.classList.remove("cm-ok", "cm-warn", "cm-bad", "cm-err");
  badge.classList.add("cm-loading");
  badge.innerHTML = SPINNER_HTML;
}
function setBadgeError(badge: HTMLElement, msg = "ERR") {
  badge.classList.remove("cm-loading", "cm-ok", "cm-warn", "cm-bad");
  badge.classList.add("cm-err");
  badge.innerHTML = ERROR_HTML;
  badge.title = msg;
}
function setBadgeScore(badge: HTMLElement, r: ScoreResult) {
  badge.classList.remove("cm-loading", "cm-err");
  const band = r.label as any;
  const label =
    (
      {
        not_cringe: "Authentic",
        try_hard: "Not bad",
        meh: "Salesy",
        cringe: "Cringe",
        wtf: "WTF",
      } as Record<string, string>
    )[band] ?? "Score";

  const cls =
    band === "not_cringe"
      ? "cm-ok"
      : band === "try_hard"
      ? "cm-ok"
      : band === "meh"
      ? "cm-warn"
      : band === "cringe"
      ? "cm-bad"
      : "cm-err";

  badge.classList.add(cls);
  badge.innerHTML = `<span class="cm-dot"></span><span>${label} · ${Math.round(
    r.score
  )}</span>`;
  badge.title = r.rationale || "";
}

// --- scoring -----------------------------------------------------------------
const PROMPT = `You are a strict "Cringe Meter" for LinkedIn posts.
Return a JSON object with keys: score (0-100 integer), label (not_cringe|try_hard|meh|cringe|wtf), rationale, suggestion.
Scoring: reward authenticity, clarity; penalize fake hype, vague hustle, engagement-bait, cliché jargon, excessive emojis/hashtags, bragging w/o substance.
0-19 not_cringe; 20-39 try_hard; 40-59 meh; 60-79 cringe; 80-100 wtf.
Only output valid JSON.
Text to score between <<< >>>.
<<<
{{TEXT}}
>>>`;

async function scoreText(text: string): Promise<ScoreResult> {
  const cfg = await chrome.storage.local.get([
    "mode",
    "openaiKey",
    "serverUrl",
  ]);
  const mode = cfg.mode ?? "openai";

  if (mode === "server") {
    const base = (cfg.serverUrl || "").replace(/\/+$/, "");
    if (!base) throw new Error("No server URL configured");
    const res = await fetch(`${base}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text } as ScorePayload),
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return (await res.json()) as ScoreResult;
  }

  // --- OpenAI mode (same prompt, strict JSON) ---
  const key = cfg.openaiKey;
  if (!key) throw new Error("No OpenAI key configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // match your server’s model if different
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 300,
      messages: [{ role: "user", content: PROMPT.replace("{{TEXT}}", text) }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  let obj: any;
  try {
    obj = JSON.parse(typeof raw === "string" ? raw : String(raw ?? "{}"));
  } catch {
    throw new Error("Bad JSON from OpenAI"); // shows ERR instead of fake 0
  }

  // sanitize
  const score = Number(obj.score);
  if (!Number.isFinite(score)) throw new Error("Bad JSON: score");
  const allowed = ["not_cringe", "try_hard", "meh", "cringe", "wtf"];
  let label = String(obj.label || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!allowed.includes(label)) label = "meh";

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    label,
    rationale: String(obj.rationale || ""),
    suggestion: String(obj.suggestion || ""),
  };
}

// --- observer ----------------------------------------------------------------
function startObserver() {
  const seen = new WeakSet<Element>();

  const processNode = (n: Element) => {
    if (seen.has(n)) return;
    if (!n.matches?.(POST_CANDIDATES)) return;

    const container = normalizeContainer(n);
    if (!container) return;

    if (!looksLikePost(container)) return;
    seen.add(container);

    const badge = ensureBadge(container);

    chrome.storage.local.get(["autoscore", "debug"], (cfg) => {
      const autoscore = (cfg.autoscore ?? "on") === "on";
      const debug = cfg.debug === true;

      const run = async () => {
        setBadgeLoading(badge);
        const text = findPostText(container);
        try {
          const r = await scoreText(text);
          setBadgeScore(badge, r);
          if (debug) console.log("[cringe] ok:", r, container);
        } catch (e: any) {
          setBadgeError(badge, e?.message || "ERR");
          if (debug) console.warn("[cringe] err:", e, container);
        }
      };

      if (autoscore) run();
      else badge.onclick = run;
    });
  };

  // initial sweep
  document.querySelectorAll(POST_CANDIDATES).forEach(processNode);

  // dynamic content
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(POST_CANDIDATES)) processNode(node);
        node.querySelectorAll?.(POST_CANDIDATES).forEach(processNode);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

if (IS_LI) startObserver();
