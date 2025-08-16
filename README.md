# Cringe Meter (LinkedIn)

Inline “cringe meter” for LinkedIn posts (Chrome extension) + website + server (thin OpenAI proxy).
Monorepo managed with pnpm workspaces.

## Monorepo Layout

```
apps/
  extension/     # Chrome MV3 extension (content script + options UI)
  web/           # Vite + React website
packages/
  shared/        # Shared TS types & helpers (Zod schemas, band utils)
server/          # Express server (OpenAI thin proxy + rate limit)
```

## Quick Start

### 0) Requirements

- **Node**: 20.x (we use ESM everywhere)
- **pnpm**: 9.x or 10.x (via Corepack)

```sh
node -v
corepack enable
corepack prepare pnpm@9.12.3 --activate   # or a recent 10.x
pnpm -v
```

If you see `Unknown option: frozen-lockfile` or Corepack key signature errors, jump to the Troubleshooting section.

### 1) Install deps (root)

```sh
pnpm install
```

### 2) First build (very important)

Build the shared package before anything else:

```sh
pnpm -w -F @cringe/shared build
pnpm build
```

### 3) Run locally

#### Server (Express)

```sh
cp server/.env.example server/.env    # create & fill secrets
pnpm dev:server
# -> http://localhost:8787 (default)
```

#### Website (Vite)

```sh
pnpm dev:web
# -> http://localhost:5173 (default)
```

#### Chrome Extension

```sh
pnpm -F @cringe/extension build
# Load unpacked: chrome://extensions → Developer mode → Load unpacked → select apps/extension/dist
```

---

## Configuration

Create `server/.env`:

```ini
# Server
PORT=8787

# OpenAI
OPENAI_API_KEY=sk-...

# Rate limit (per IP per 24h)
DAILY_LIMIT=50

# Optional Redis for distributed rate limiting; leave empty to use in-memory
REDIS_URL=
```

---

## API (server)

### POST /score

**Body:**

```json
{ "text": "..." }
```

**Resp:**

```json
{
  "score": 0..100,
  "label": "not_cringe" | "try_hard" | "meh" | "cringe" | "wtf",
  "rationale": "string",
  "suggestion": "string"
}
```

The server prompt is consistent with the extension (OpenAI mode) and returns strict JSON.

---

## Build & Deploy

### Website → S3/Static

```sh
pnpm -F @cringe/web build
# upload apps/web/dist/** to S3 (optionally front with CloudFront)
```

Recommended `<head>` (already in template):

```html
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#0b0f14" />
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

### Server → Render (or any Node host)

Build command:

```sh
pnpm install && pnpm -w -F @cringe/shared build && pnpm -F server build
```

Start command:

```sh
node server/dist/index.js
```

Env: `OPENAI_API_KEY`, `DAILY_LIMIT`, `REDIS_URL?`, `PORT` (Render sets its own, so use `process.env.PORT`).

Our `server/package.json` uses `tsc → dist/`. Don’t forget to build `@cringe/shared` first.

### Chrome Web Store

Build zip:

```sh
pnpm -F @cringe/extension build
cd apps/extension/dist
zip -r ../cringe-meter-vX.Y.Z.zip .
```

Upload in Developer Dashboard, fill listing, privacy, and submit.

---

## Development Scripts

At the repo root:

```json
"scripts": {
  "build": "pnpm -r run build",
  "dev:server": "pnpm --filter server dev",
  "dev:web": "pnpm --filter @cringe/web dev",
  "build:extension": "pnpm --filter @cringe/extension build",
  "typecheck": "pnpm -r run typecheck"
}
```

---

## Known Gotchas

### 1) “Cannot find module '@cringe/shared'” (or types)

- Build shared first: `pnpm -w -F @cringe/shared build`
- Ensure `packages/shared/package.json` has:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  }
}
```

- Don’t import via relative path, always use `@cringe/shared`.

### 2) TypeScript Node/Express types

If you see `TS2688` / `TS7016`:

```sh
pnpm -F server add -D @types/node @types/express @types/cors @types/morgan
```

In `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "rootDir": "src",
    "outDir": "dist",
    "skipLibCheck": true
  }
}
```

### 3) ioredis types

```ts
import Redis from "ioredis";
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
```

If TS still complains (older types):

```ts
import * as IORedis from "ioredis";
const RedisCtor = (IORedis as any).default || IORedis;
const redis = process.env.REDIS_URL
  ? new RedisCtor(process.env.REDIS_URL)
  : null;
```

### 4) Extension: missing `chrome` types

```sh
pnpm add -D @types/chrome -w
```

In `apps/extension/tsconfig.json`:

```json
{ "compilerOptions": { "types": ["chrome"] } }
```

### 5) Extension: manifest/assets not copied

Ensure `apps/extension/scripts/copy.js` copies:

- `manifest.json`
- `options.html, options.js/css`
- `ui.css`
- `icons/**`

Script should be:

```json
"build": "tsc -p tsconfig.json && node ./scripts/copy.js"
```

### 6) Corepack / pnpm errors

- Signature error:

```sh
corepack disable
npm i -g pnpm@9
# or
corepack enable
corepack prepare pnpm@9.12.3 --activate
```

- `Unknown option: frozen-lockfile`: update pnpm or just run `pnpm install`.

### 7) Server “no dist/index.js”

You forgot to build:

```sh
pnpm -w -F @cringe/shared build
pnpm -F server build
node server/dist/index.js
```

### 8) Extension badge not showing

Check `manifest.json`:

```json
"permissions": ["storage"],
"host_permissions": ["https://www.linkedin.com/*"]
```

Enable debug:

```js
chrome.storage.local.set({ debug: true });
```

### 9) Popover issues

Fixed in latest build. If misaligned, rebuild & reload.

---

## Rate Limiting

- Per-IP daily limit via Redis (or in-memory fallback).
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Returns **429** when exceeded.

---

## Contributing

- Keep shared types in `packages/shared`.
- Prefer ESM imports; avoid path hacks to `src`.
- Run `pnpm typecheck` before PRs.

---

## License

MIT. Not affiliated with LinkedIn.  
“LinkedIn” is a trademark of LinkedIn Corp.

---

## Example `.env`

```ini
PORT=8787
OPENAI_API_KEY=
DAILY_LIMIT=50
REDIS_URL=
```
