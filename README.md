### Cringe Meter (LinkedIn)

Inline “cringe meter” for LinkedIn posts (Chrome extension) + website + server (thin OpenAI proxy). Monorepo managed with pnpm workspaces.

Table of contents

Monorepo layout

Requirements

Install

Build

Run locally

Configuration

API

Deploy

Chrome Extension

Troubleshooting

Contributing

License

Monorepo layout
apps/
extension/ # Chrome MV3 extension (content script + options UI)
web/ # Vite + React website
packages/
shared/ # Shared TS types & helpers (Zod schemas, band utils)
server/ # Express server (OpenAI thin proxy + rate limit)

Requirements

Node 20.x

pnpm 9.x or 10.x (managed via Corepack)

node -v
corepack enable
corepack prepare pnpm@9.12.3 --activate # or a recent 10.x
pnpm -v

Install

From repo root:

pnpm install

Build

Build shared first (important), then everything:

pnpm -w -F @cringe/shared build
pnpm build

Run locally
Server (Express)
cp server/.env.example server/.env
pnpm dev:server

# -> http://localhost:8787

Website (Vite)
pnpm dev:web

# -> http://localhost:5173

Chrome extension
pnpm -F @cringe/extension build

# Chrome → chrome://extensions → Developer mode → Load unpacked → apps/extension/dist

Configuration

Create server/.env:

# Server

PORT=8787

# OpenAI

OPENAI_API_KEY=sk-...

# Rate limit (per IP per 24h)

DAILY_LIMIT=50

# Optional: Redis for distributed rate limiting

REDIS_URL=

API

POST /score

Request:

{ "text": "LinkedIn post text..." }

Response:

{
"score": 0,
"label": "not_cringe",
"rationale": "why the score",
"suggestion": "rewrite suggestion"
}

Labels: not_cringe, try_hard, meh, cringe, wtf.

Deploy
Website → S3 (static)
pnpm -F @cringe/web build

# upload apps/web/dist/\*\* to S3 (optionally behind CloudFront)

Recommended in apps/web/index.html:

Icons (/favicon.svg, apple-touch icon)

Theme color: <meta name="theme-color" content="#0b0f14">

Viewport: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover

Server → Render (or any Node host)

Build command:

pnpm install
pnpm -w -F @cringe/shared build
pnpm -F server build

Start command:

node server/dist/index.js

Env: OPENAI_API_KEY, DAILY_LIMIT, REDIS_URL?, PORT (or use host’s PORT).

Chrome Extension

Build a distributable zip:

pnpm -F @cringe/extension build
cd apps/extension/dist
zip -r ../cringe-meter-vX.Y.Z.zip .

Upload the zip in the Chrome Web Store Developer Dashboard.
Permissions: only storage and https://www.linkedin.com/*.

Troubleshooting
Cannot find module @cringe/shared

Build shared first:

pnpm -w -F @cringe/shared build

Ensure packages/shared/package.json:

{
"main": "dist/index.js",
"types": "dist/index.d.ts",
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
}

Import @cringe/shared (do not import from ../packages/shared/src).

Type errors for Node/express types
pnpm -F server add -D @types/node @types/express @types/cors @types/morgan

server/tsconfig.json should include:

{
"compilerOptions": {
"module": "NodeNext",
"moduleResolution": "NodeNext",
"types": ["node"],
"rootDir": "src",
"outDir": "dist",
"strict": true,
"skipLibCheck": true
}
}

ioredis “not constructable”

Use default import:

import Redis from "ioredis";
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

If types still complain:

import \* as IORedis from "ioredis";
const RedisCtor = (IORedis as any).default || IORedis;
const redis = process.env.REDIS_URL ? new RedisCtor(process.env.REDIS_URL) : null;

Extension: missing Chrome types
pnpm add -D @types/chrome -w

apps/extension/tsconfig.json should include:

{ "compilerOptions": { "types": ["chrome"] } }

Extension: manifest/assets not copied

Build script must copy:

manifest.json

options.html (+ its JS/CSS)

ui.css

icons/\*\*

Script example in apps/extension/package.json:

"build": "tsc -p tsconfig.json && node ./scripts/copy.js"

Corepack / pnpm issues

Signature error:

corepack disable
npm i -g pnpm@9

# or

corepack enable
corepack prepare pnpm@9.12.3 --activate

Unknown option: frozen-lockfile → update pnpm or drop that flag.

Server: no dist/index.js

You forgot to build:

pnpm -w -F @cringe/shared build
pnpm -F server build
node server/dist/index.js

Extension badge missing

Ensure you’re on https://www.linkedin.com/* with real posts (activity/ugcPost).

Reload unpacked extension after build.

Debug:

chrome.storage.local.set({ debug: true })

Contributing

Keep shared types in packages/shared.

Use ESM imports.

Run pnpm typecheck before PRs.

License

MIT. Not affiliated with LinkedIn. “LinkedIn” is a trademark of LinkedIn Corp.

.env.example (server)
PORT=8787
OPENAI_API_KEY=
DAILY_LIMIT=50
REDIS_URL=
