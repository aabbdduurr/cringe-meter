const modeEl = document.getElementById("mode") as HTMLSelectElement;
const keyEl = document.getElementById("openaiKey") as HTMLInputElement;
const serverEl = document.getElementById("serverUrl") as HTMLInputElement;
const autoscoreEl = document.getElementById("autoscore") as HTMLSelectElement;
const openaiRow = document.getElementById("openaiRow")!;
const serverRow = document.getElementById("serverRow")!;
const saveBtn = document.getElementById("save") as HTMLButtonElement;

function updateVis() {
  const m = modeEl.value;
  openaiRow.style.display = m === "openai" ? "" : "none";
  serverRow.style.display = m === "server" ? "" : "none";
}

modeEl.addEventListener("change", updateVis);

chrome.storage.local.get(
  ["mode", "openaiKey", "serverUrl", "autoscore"],
  (cfg) => {
    modeEl.value = cfg.mode ?? "openai";
    keyEl.value = cfg.openaiKey ?? "";
    serverEl.value = cfg.serverUrl ?? "";
    autoscoreEl.value = cfg.autoscore ?? "on";
    updateVis();
  }
);

saveBtn.onclick = async () => {
  await chrome.storage.local.set({
    mode: modeEl.value,
    openaiKey: keyEl.value.trim(),
    serverUrl: serverEl.value.trim().replace(/\/+$/, ""),
    autoscore: autoscoreEl.value,
  });
  saveBtn.textContent = "Saved ✔";
  setTimeout(() => (saveBtn.textContent = "Save"), 900);
};
