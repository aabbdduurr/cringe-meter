// server/src/ratelimit.ts
import type { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * Limits
 * - DAILY_LIMIT  (default 50)
 * - MINUTE_LIMIT (default 10)
 */
const DAILY_LIMIT = Number(env.dailyLimit ?? 50);
const MINUTE_LIMIT = Number(env.minuteLimit ?? 10);

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const redis = env.redisUrl ? new Redis(env.redisUrl) : null;

/**
 * Atomic sliding-window limiter (minute + day) with Redis ZSETs.
 */
const LUA = `
-- KEYS[1] minute key, KEYS[2] day key
-- ARGV[1] nowMs
-- ARGV[2] minuteCutoffMs
-- ARGV[3] minuteTTL
-- ARGV[4] dayCutoffMs
-- ARGV[5] dayTTL

-- minute window
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1])
local mcount = redis.call('ZCARD', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
local mttl = redis.call('PTTL', KEYS[1])

-- day window
redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, ARGV[4])
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[1])
local dcount = redis.call('ZCARD', KEYS[2])
redis.call('PEXPIRE', KEYS[2], ARGV[5])
local dttl = redis.call('PTTL', KEYS[2])

return {mcount, dcount, mttl, dttl}
`;

type MemBuckets = { minute: number[]; day: number[] };
const mem = new Map<string, MemBuckets>();

function getClientId(req: Request) {
  // If you later send a client UUID from the extension, prefer it:
  // fetch(..., { headers: { 'x-cringe-client': '<uuid>' } })
  return (req.get("x-cringe-client") || req.ip || "unknown").trim();
}

function headerify(
  res: Response,
  minuteCount: number,
  dayCount: number,
  minuteTtlMs: number,
  dayTtlMs: number
) {
  const nowSec = Math.ceil(Date.now() / 1000);
  res.setHeader(
    "X-RateLimit-Policy",
    `window=60; limit=${MINUTE_LIMIT}, window=86400; limit=${DAILY_LIMIT}`
  );
  res.setHeader("X-RateLimit-Limit-Minute", String(MINUTE_LIMIT));
  res.setHeader(
    "X-RateLimit-Remaining-Minute",
    String(Math.max(0, MINUTE_LIMIT - minuteCount))
  );
  res.setHeader(
    "X-RateLimit-Reset-Minute",
    String(nowSec + Math.max(0, Math.floor(minuteTtlMs / 1000)))
  );
  res.setHeader("X-RateLimit-Limit", String(DAILY_LIMIT));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(0, DAILY_LIMIT - dayCount))
  );
  res.setHeader(
    "X-RateLimit-Reset",
    String(nowSec + Math.max(0, Math.floor(dayTtlMs / 1000)))
  );
}

export async function ratelimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = getClientId(req);
  const now = Date.now();

  try {
    // ---------- Redis path ----------
    if (redis) {
      const kMin = `cm:minute:${id}`;
      const kDay = `cm:day:${id}`;

      const [mCount, dCount, mTtl, dTtl] = (await redis.eval(
        LUA,
        2,
        kMin,
        kDay,
        now,
        now - MINUTE_MS,
        MINUTE_MS,
        now - DAY_MS,
        DAY_MS
      )) as [number, number, number, number];

      headerify(res, mCount, dCount, mTtl, dTtl);

      if (mCount > MINUTE_LIMIT) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil(mTtl / 1000)))
        );
        return res
          .status(429)
          .json({ error: "Too many requests (per-minute limit)" });
      }
      if (dCount > DAILY_LIMIT) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil(dTtl / 1000)))
        );
        return res.status(429).json({ error: "Daily limit exceeded" });
      }

      return next();
    }

    // ---------- In-memory fallback (sliding windows) ----------
    let b = mem.get(id);
    if (!b) {
      b = { minute: [], day: [] };
      mem.set(id, b);
    }

    const minCut = now - MINUTE_MS;
    const dayCut = now - DAY_MS;

    // trim old entries
    b.minute = b.minute.filter((t) => t > minCut);
    b.day = b.day.filter((t) => t > dayCut);

    // add this request
    b.minute.push(now);
    b.day.push(now);

    const mCount = b.minute.length;
    const dCount = b.day.length;
    const mTtl = Math.max(0, MINUTE_MS - (now - (b.minute[0] ?? now)));
    const dTtl = Math.max(0, DAY_MS - (now - (b.day[0] ?? now)));

    headerify(res, mCount, dCount, mTtl, dTtl);

    if (mCount > MINUTE_LIMIT) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(mTtl / 1000))));
      return res
        .status(429)
        .json({ error: "Too many requests (per-minute limit)" });
    }
    if (dCount > DAILY_LIMIT) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(dTtl / 1000))));
      return res.status(429).json({ error: "Daily limit exceeded" });
    }

    next();
  } catch {
    // Fail-open on limiter errors
    next();
  }
}

// Tiny janitor to keep the map bounded in memory mode
const JANITOR_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of mem) {
    b.minute = b.minute.filter((t) => now - t < MINUTE_MS);
    b.day = b.day.filter((t) => now - t < DAY_MS);
    if (!b.minute.length && !b.day.length) mem.delete(id);
  }
}).unref();
