import { z } from "zod";

export const CringeResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(["not_cringe", "try_hard", "meh", "cringe", "wtf"]),
  rationale: z.string().optional(),
  suggestion: z.string().optional(),
});

export type CringeResult = z.infer<typeof CringeResultSchema>;

export const ScoreRequestSchema = z.object({
  text: z.string().min(1).max(8000),
});
