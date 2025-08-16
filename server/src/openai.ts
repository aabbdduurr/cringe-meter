import OpenAI from "openai";
import { env } from "./env.js";
import { bandFromScore } from "@cringe/shared";

const client = new OpenAI({ apiKey: env.openaiKey });

const PROMPT = `You are a strict "Cringe Meter" for LinkedIn posts.\nReturn a JSON object with keys: score (0-100 integer), label (not_cringe|try_hard|meh|cringe|wtf), rationale, suggestion.\nScoring: reward authenticity, clarity; penalize fake hype, vague hustle, engagement-bait, cliché jargon, excessive emojis/hashtags, bragging w/o substance.\n0-19 not_cringe; 20-39 try_hard; 40-59 meh; 60-79 cringe; 80-100 wtf.\nOnly output valid JSON.\nText to score between <<< >>>.\n<<<\n{{TEXT}}\n>>>`;

export async function scoreWithOpenAI(text: string) {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: PROMPT.replace("{{TEXT}}", text) }],
  });

  const content = res.choices?.[0]?.message?.content || "{}";
  let j: any;
  try {
    j = JSON.parse(content);
  } catch {
    const fixed = content.replace(/```json|```/g, "");
    j = JSON.parse(fixed);
  }

  let score = Math.max(0, Math.min(100, Math.round(Number(j.score)))) || 0;
  const label = j.label || bandFromScore(score);
  return { score, label, rationale: j.rationale, suggestion: j.suggestion };
}
