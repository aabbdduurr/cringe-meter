import { Router } from "express";
import { z } from "zod";
import { ScoreRequestSchema } from "@cringe/shared";
import { scoreWithOpenAI } from "./openai.js";

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/score", async (req, res) => {
  const parsed = ScoreRequestSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid request" });

  try {
    const result = await scoreWithOpenAI(parsed.data.text);
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Upstream error" });
  }
});
