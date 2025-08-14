export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8787";

export async function score(text: string) {
  const r = await fetch(`${API_BASE}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}
