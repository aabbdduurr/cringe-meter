const POST_SELECTOR = "article, div.feed-shared-update-v2";
const ATTR = "data-cringe-ready";

const observer = new MutationObserver(() => scan());
scan();
observer.observe(document.body, { childList: true, subtree: true });

async function scan() {
  const { auto } = await chrome.storage.local.get(["auto"]);
  document.querySelectorAll(POST_SELECTOR).forEach(async (node) => {
    const el = node as HTMLElement;
    if (el.getAttribute(ATTR)) return;
    const text = extractText(el);
    if (!text || text.length < 40) return; // skip short
    el.setAttribute(ATTR, "1");
    if (auto !== false) scoreAndBadge(el, text);
  });
}

function extractText(el: HTMLElement) {
  const t = el.innerText || el.textContent || "";
  return t.replace(/\s+/g, " ").trim();
}

async function scoreAndBadge(el: HTMLElement, text: string) {
  const res = await chrome.runtime.sendMessage({ type: "CRINGE_SCORE", text });
  injectBadge(el, res);
}

function injectBadge(el: HTMLElement, res: any) {
  const existing = el.querySelector(".cringe-meter-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.className = "cringe-meter-badge";
  const color = bandColor(res.label);
  badge.innerHTML =
    `<div class="bar" style="background:${color}"></div>` +
    `<div class="score">${res.score}</div>` +
    `<div class="tag">${String(res.label).replace("_", " ")}</div>` +
    `<div class="cringe-meter-tooltip">${res.rationale || ""}${
      res.suggestion ? `<br/><b>Rewrite:</b> ${res.suggestion}` : ""
    }</div>`;

  el.style.position ||= "relative";
  el.appendChild(badge);
}

function bandColor(label: string) {
  switch (label) {
    case "not_cringe":
      return "#23c55e";
    case "try_hard":
      return "#84cc16";
    case "meh":
      return "#facc15";
    case "cringe":
      return "#f97316";
    case "wtf":
      return "#ef4444";
    default:
      return "#9ca3af";
  }
}
