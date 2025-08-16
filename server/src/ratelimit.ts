import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";
import { Redis } from "ioredis";

// In-memory fallback; Redis if REDIS_URL provided.
const memory = new Map<string, { count: number; resetAt: number }>();
const redis = env.redisUrl ? new Redis(env.redisUrl) : null;

function key(ip: string) {
  const d = new Date();
  const day = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  return `cm:${day}:${ip}`;
}

export async function ratelimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = (
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  ).trim();
  const k = key(ip);

  try {
    if (redis) {
      const v = await redis.incr(k);
      if (v === 1) {
        const ttl = 86400 - (Math.floor(Date.now() / 1000) % 86400);
        await redis.expire(k, ttl);
      }
      if (v > env.dailyLimit)
        return res.status(429).json({ error: "Daily limit exceeded" });
      res.setHeader("X-RateLimit-Limit", env.dailyLimit.toString());
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, env.dailyLimit - v))
      );
      return next();
    }
    // Memory fallback
    const now = Date.now();
    const rec = memory.get(k);
    if (!rec || now > rec.resetAt) {
      memory.set(k, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
      res.setHeader("X-RateLimit-Remaining", String(env.dailyLimit - 1));
      return next();
    }
    if (rec.count >= env.dailyLimit)
      return res.status(429).json({ error: "Daily limit exceeded" });
    rec.count += 1;
    memory.set(k, rec);
    res.setHeader("X-RateLimit-Remaining", String(env.dailyLimit - rec.count));
    next();
  } catch (e) {
    // Fail-open
    next();
  }
}
