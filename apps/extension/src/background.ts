chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg.type === "CRINGE_SCORE") {
    doScore(msg.text).then(send);
    return true;
  }
});

async function doScore(text: string) {
  const { server } = await chrome.storage.local.get(["server"]);
  const base = server || "http://localhost:8787";
  try {
    const r = await fetch(`${base}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error("server error");
    return await r.json();
  } catch (e: any) {
    return {
      score: 0,
      label: "meh",
      rationale: "Server unreachable",
      suggestion: "",
    };
  }
}
