import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) server/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// 2) repo-root/.env (fallback)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT || 8787),
  openaiKey: process.env.OPENAI_API_KEY || "",
  dailyLimit: Number(process.env.DAILY_LIMIT || 50),
  minuteLimit: Number(process.env.MINUTE_LIMIT || 5),
  redisUrl: process.env.REDIS_URL || "",
};

if (!env.openaiKey) {
  console.warn(
    "[WARN] OPENAI_API_KEY is not set. /score will fail until you set it."
  );
}
