export type Label = "not_cringe" | "try_hard" | "meh" | "cringe" | "wtf";

export const bandFromScore = (score: number): Label => {
  if (score < 20) return "not_cringe";
  if (score < 40) return "try_hard";
  if (score < 60) return "meh";
  if (score < 80) return "cringe";
  return "wtf";
};

export const labelColors: Record<Label, string> = {
  not_cringe: "#23c55e", // green
  try_hard: "#84cc16", // lime
  meh: "#facc15", // amber
  cringe: "#f97316", // orange
  wtf: "#ef4444", // red
};
