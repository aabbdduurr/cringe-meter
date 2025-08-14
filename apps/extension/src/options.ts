const server = document.getElementById("server") as HTMLInputElement;
const auto = document.getElementById("auto") as HTMLInputElement;
const save = document.getElementById("save") as HTMLButtonElement;
const saved = document.getElementById("saved") as HTMLDivElement;

chrome.storage.local.get(["server", "auto"]).then((v) => {
  server.value = v.server || "http://localhost:8787";
  auto.checked = v.auto ?? true;
});

save.onclick = async () => {
  await chrome.storage.local.set({ server: server.value, auto: auto.checked });
  saved.style.display = "block";
  setTimeout(() => (saved.style.display = "none"), 1500);
};
