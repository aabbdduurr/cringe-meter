type ScorePayload = { text: string };
type ScoreResult = {
  score: number;
  label: "not_cringe" | "try_hard" | "meh" | "cringe" | "wtf" | string;
  rationale?: string;
  suggestion?: string;
};

const hasChromeStorage =
  typeof chrome !== "undefined" && !!chrome?.storage?.local;

type KV = Record<string, any>;
function readLocal(keys: string[]): Promise<KV> {
  if (!hasChromeStorage) return Promise.resolve({});
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function writeLocal(obj: KV): Promise<void> {
  if (!hasChromeStorage) return Promise.resolve();
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

const IS_LI = location.hostname.includes("linkedin.com");
if (!IS_LI) {
  /* safety */
}

const VALID_POST_URN = /urn:li:(activity|ugcpost):/i;

function findPostAnchor(root: Element): HTMLElement | null {
  const up = root.closest("[data-urn]") as HTMLElement | null;
  if (
    up?.getAttribute("data-urn") &&
    VALID_POST_URN.test(up.getAttribute("data-urn")!)
  ) {
    return up;
  }

  const down =
    (root.querySelector(
      '[data-urn^="urn:li:activity:"]'
    ) as HTMLElement | null) ||
    (root.querySelector('[data-urn^="urn:li:ugcPost:"]') as HTMLElement | null);
  if (
    down?.getAttribute("data-urn") &&
    VALID_POST_URN.test(down.getAttribute("data-urn")!)
  ) {
    return down;
  }
  return null;
}

const POST_CANDIDATES = [
  'article[data-urn^="urn:li:activity:"]',
  'article[data-urn^="urn:li:ugcPost:"]',
  'div[data-urn^="urn:li:activity:"]',
  'div[data-urn^="urn:li:ugcPost:"]',
  "div.feed-shared-update-v2",
  "div.update-components-card",
].join(",");

const SPINNER_HTML = `<span class="cm-dot cm-spin"></span><span> Scoring…</span>`;
const ERROR_HTML = `<span class="cm-dot cm-red"></span><span> ERR</span>`;

const results = new WeakMap<HTMLElement, ScoreResult>();
const popovers = new WeakMap<HTMLElement, HTMLElement>();
const hostIndex = new Map<string, HTMLElement>(); // reverse: hostId -> container
let globalClickBound = false;

// ---------- utils ----------
const ESC = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );

function findPostText(el: Element): string {
  const candidates = [
    '[data-test-id="post-content"]',
    "div.update-components-text",
    "div.feed-shared-inline-show-more-text",
    "div.feed-shared-update-v2__description-wrapper",
    "div.feed-shared-text__text-view",
    'span[dir="ltr"]',
    ".update-components-text",
    ".break-words",
  ];
  for (const sel of candidates) {
    const n = (el as HTMLElement).querySelector(sel);
    if (!n) continue;
    const t = n.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (t.length > 20) return t.slice(0, 4000);
  }
  const t = (el.textContent || "").replace(/\s+/g, " ").trim();
  return t.slice(0, 4000);
}

function normalizeContainer(node: Element): HTMLElement {
  const article = node.closest("article");
  const container = (article || node) as HTMLElement;
  const cs = getComputedStyle(container);
  if (cs.position === "static") container.style.position = "relative";
  return container;
}

function looksLikePost(node: Element): boolean {
  const text = findPostText(node);
  if (text.length < 20) return false;
  const s = node.textContent || "";
  if (/Promoted|Sponsored/i.test(s)) return false;
  return true;
}

// ---------- badge ----------
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
  const labelText =
    (
      {
        not_cringe: "Authentic",
        try_hard: "Not bad",
        meh: "Meh",
        cringe: "Cringe",
        wtf: "WTF",
      } as Record<string, string>
    )[r.label] ?? "Score";

  const cls =
    r.label === "not_cringe"
      ? "cm-ok"
      : r.label === "try_hard"
      ? "cm-ok"
      : r.label === "meh"
      ? "cm-warn"
      : r.label === "cringe"
      ? "cm-bad"
      : "cm-err";

  badge.classList.add(cls);
  badge.innerHTML = `<span class="cm-dot"></span><span>${labelText} · ${Math.round(
    r.score
  )}</span>`;
  badge.title = r.rationale || "";
}

// ---------- popover ----------
function ensurePopover(container: HTMLElement): HTMLElement {
  let pop = popovers.get(container);
  if (pop) return pop;

  pop = document.createElement("div");
  pop.className = "cm-popover";
  pop.innerHTML = `
    <div class="cm-popover-arrow"></div>
    <div class="cm-popover-body">
      <div class="cm-popover-title">CRINGE METER</div>
      <div class="cm-popover-content">
        <div class="cm-popover-loading">
          <span class="cm-dot cm-spin"></span><span> Scoring…</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(pop);

  let hostId = (container as any).__cmHostId as string | undefined;
  if (!hostId) {
    hostId =
      (crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2);
    (container as any).__cmHostId = hostId;
  }
  pop.dataset.host = hostId;
  hostIndex.set(hostId || "", container);

  popovers.set(container, pop);
  return pop;
}

function closeAllPopovers() {
  document.querySelectorAll<HTMLElement>(".cm-popover.cm-show").forEach((p) => {
    p.classList.remove("cm-show", "cm-top");
    p.style.display = "none";
    p.style.visibility = "";
  });
}
function closePopover(container: HTMLElement) {
  const pop = popovers.get(container);
  if (!pop) return;
  pop.classList.remove("cm-show", "cm-top");
  pop.style.display = "none";
  pop.style.visibility = "";
}
function positionPopover(badge: HTMLElement, pop: HTMLElement) {
  const r = badge.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const pw = Math.min(320, vw - pad * 2);

  pop.style.width = pw + "px";
  pop.style.maxWidth = `calc(100vw - ${pad * 2}px)`;
  pop.style.visibility = "hidden";
  pop.style.display = "block";
  let ph = pop.getBoundingClientRect().height || 160;

  let top = r.bottom + 10;
  let placeAbove = false;
  if (top + ph > vh - pad) {
    top = Math.max(pad, r.top - ph - 10);
    placeAbove = true;
  }

  let left = r.right - pw;
  left = Math.max(pad, Math.min(left, vw - pw - pad));

  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.classList.toggle("cm-top", placeAbove);
  pop.style.visibility = "visible";

  const arrow = Math.max(12, Math.min(pw - 12, r.right - left - 12));
  pop.style.setProperty("--ax", `${Math.round(arrow)}px`);
}

function renderPopover(pop: HTMLElement, r: ScoreResult | Error) {
  const body = pop.querySelector(".cm-popover-content") as HTMLElement;
  if (!body) return;

  if (r instanceof Error) {
    body.innerHTML = `
      <div class="cm-popover-error">
        <span class="cm-dot cm-red"></span>
        <div>
          <div class="cm-err-title">Error</div>
          <div class="cm-err-msg">${ESC(r.message || "Failed")}</div>
        </div>
      </div>`;
    return;
  }

  const band = r.label;
  const labelText =
    (
      {
        not_cringe: "Authentic (0–19)",
        try_hard: "Not bad (20–39)",
        meh: "Meh (40–59)",
        cringe: "Cringe (60–79)",
        wtf: "WTF (80–100)",
      } as Record<string, string>
    )[band] ?? "Score";

  const bandClass =
    band === "not_cringe"
      ? "cm-tag-ok"
      : band === "try_hard"
      ? "cm-tag-ok"
      : band === "meh"
      ? "cm-tag-warn"
      : band === "cringe"
      ? "cm-tag-bad"
      : "cm-tag-err";

  body.innerHTML = `
    <div class="cm-popover-row">
      <span class="cm-tag ${bandClass}">${ESC(labelText)}</span>
      <span class="cm-score">${Math.round(r.score)}</span>
    </div>
    ${
      r.rationale
        ? `<div class="cm-section"><div class="cm-section-title">Why</div><div class="cm-section-text">${ESC(
            r.rationale
          )}</div></div>`
        : ""
    }
    ${
      r.suggestion
        ? `<div class="cm-section"><div class="cm-section-title">Rewrite</div><div class="cm-section-text">${ESC(
            r.suggestion
          )}</div></div>`
        : ""
    }`;
}

function openPopover(container: HTMLElement, badge: HTMLElement) {
  const pop = ensurePopover(container);
  closeAllPopovers();

  const r = results.get(container);
  if (r) renderPopover(pop, r);
  else
    (
      pop.querySelector(".cm-popover-content") as HTMLElement
    ).innerHTML = `<div class="cm-popover-loading"><span class="cm-dot cm-spin"></span><span> Scoring…</span></div>`;

  pop.classList.add("cm-show");
  positionPopover(badge, pop);

  if (!globalClickBound) {
    globalClickBound = true;
    addEventListener(
      "click",
      (e) => {
        const t = e.target as Element;
        if (!t) return;
        if (t.closest(".cm-popover") || t.closest(".cm-badge")) return;
        closeAllPopovers();
      },
      true
    );
    addEventListener(
      "keydown",
      (e: KeyboardEvent) => e.key === "Escape" && closeAllPopovers()
    );
    addEventListener(
      "scroll",
      () => {
        document
          .querySelectorAll<HTMLElement>(".cm-popover.cm-show")
          .forEach((p) => {
            const hostId = p.dataset.host;
            if (!hostId) return;
            const host = hostIndex.get(hostId);
            if (!host) return;
            const badge = host.querySelector(".cm-badge") as HTMLElement | null;
            if (badge) positionPopover(badge, p);
          });
      },
      { passive: true }
    );

    addEventListener("resize", () => {
      document
        .querySelectorAll<HTMLElement>(".cm-popover.cm-show")
        .forEach((p) => {
          const hostId = p.dataset.host;
          if (!hostId) return;
          const host = hostIndex.get(hostId);
          if (!host) return;
          const badge = host.querySelector(".cm-badge") as HTMLElement | null;
          if (badge) positionPopover(badge, p);
        });
    });
  }
}

// ---------- scoring ----------
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
  const cfg = await readLocal(["mode", "openaiKey", "serverUrl"]);
  const mode = (cfg.mode as string) ?? "openai";

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

  const key = cfg.openaiKey;
  if (!key) throw new Error("No OpenAI key configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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
    throw new Error("Bad JSON from OpenAI");
  }

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

// ---------- observer ----------
function startObserver() {
  const seen = new WeakSet<Element>();

  const processNode = (n: Element) => {
    if (seen.has(n)) return;
    if (!n.matches?.(POST_CANDIDATES)) return;

    const anchor = findPostAnchor(n);
    if (!anchor) return;

    const container = normalizeContainer(anchor);
    if (!container || !looksLikePost(container)) return;
    seen.add(container);

    const badge = ensureBadge(container);

    readLocal(["autoscore", "debug"]).then((cfg) => {
      const autoscore = (cfg.autoscore ?? "on") === "on";
      const debug = cfg.debug === true;

      const run = async (openAfter = false) => {
        setBadgeLoading(badge);
        const text = findPostText(container);
        try {
          const r = await scoreText(text);
          results.set(container, r);
          setBadgeScore(badge, r);
          if (openAfter) openPopover(container, badge);
          if (debug) console.log("[cringe] ok:", r, container);
        } catch (e: any) {
          setBadgeError(badge, e?.message || "ERR");
          results.delete(container);
          if (openAfter) openPopover(container, badge);
          if (debug) console.warn("[cringe] err:", e, container);
        }
      };

      badge.onclick = () => {
        const existing = results.get(container);
        if (existing) {
          const pop = popovers.get(container);
          const isOpen = !!pop?.classList.contains("cm-show");
          if (isOpen) closePopover(container);
          else openPopover(container, badge);
        } else {
          openPopover(container, badge);
          run(true);
        }
      };

      if (autoscore) run(false);
    });
  };

  document.querySelectorAll(POST_CANDIDATES).forEach(processNode);

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
