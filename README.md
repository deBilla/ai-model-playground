# AI Model Playground

A side-by-side AI model comparison tool that streams responses from multiple providers simultaneously, showing real-time latency, token counts, and cost estimates for each.

---

## Overview

Submit a single prompt and watch GPT-4o, Claude 3.5 Sonnet, Grok Beta, and DeepSeek-V3 respond in parallel, streamed token-by-token. Each panel shows live output with a metrics footer (tokens, cost, latency) once complete. Past comparisons are saved to a local database and can be restored from the history drawer.

---

## Architecture

### Config-Driven Provider System

All model definitions live in a single file: `lib/models.config.ts`. Each entry contains the model's display label, gateway routing string, and per-million-token pricing. Adding a new model requires exactly one change — a new object in the `MODELS` array — and zero changes to any route, component, or store.

```ts
// lib/models.config.ts
export const MODELS = [
  {
    id: 'openai',
    label: 'GPT-4o',
    provider: 'OpenAI',
    gatewayModel: 'openai/gpt-4o',
    inputCostPer1M: 5.00,
    outputCostPer1M: 15.00,
    color: 'bg-emerald-900/60',
    textColor: 'text-emerald-400',
  },
  // ... add more here
] as const
```

The `as const` assertion gives TypeScript literal types for `id`, making `ProviderId = 'openai' | 'anthropic' | 'xai' | 'deepseek'` a union of string literals — fully type-checked everywhere.

### API Design: One Route, Parallel Fetches

There is a single `/api/chat` route that accepts `{ prompt, provider }` and streams an NDJSON response for that one provider. The frontend calls this route once per model, all in parallel via `Promise.allSettled`. Each call updates its own Zustand panel slice independently as tokens arrive.

This beats a single `/api/compare` route that fans out server-side because:

- **True parallelism**: each browser fetch is a separate HTTP/2 stream, not a server-side fan-out bottleneck
- **Independent failure**: if one provider errors, the other three continue unaffected
- **Simpler streaming**: each route streams a single NDJSON sequence; no multiplexing needed

The NDJSON protocol uses a `t` discriminant on each line:
```json
{ "t": "text",  "v": "Hello" }
{ "t": "meta",  "promptTokens": 12, "completionTokens": 48, "latencyMs": 1340, "estimatedCost": 0.00042 }
{ "t": "error", "v": "Rate limit exceeded" }
```

### Vercel AI Gateway — Single Key

All four providers are routed through the Vercel AI Gateway using one `VERCEL_AI_GATEWAY_KEY`. The gateway exposes an OpenAI-compatible interface, so a single `createOpenAI` client handles all providers. Each model is addressed by a namespaced string like `openai/gpt-4o` or `anthropic/claude-3-5-sonnet-20241022`.

---

## Project Structure

```
ai-model-playground/
├── app/
│   ├── api/
│   │   ├── chat/route.ts         # Streaming endpoint — one provider per request
│   │   └── history/route.ts      # GET/POST comparison history to DB
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page — orchestrates parallel streams
│
├── components/
│   ├── CompareLayout.tsx         # Responsive grid of model panels + sync scroll
│   ├── HistoryDrawer.tsx         # Slide-out drawer with past comparisons
│   ├── MetricsBadge.tsx          # Token / cost / latency badges
│   ├── ModelPanel.tsx            # Single model response panel with status
│   └── PromptInput.tsx           # Textarea + submit button
│
├── lib/
│   ├── models.config.ts          # ★ Single source of truth for all models
│   ├── db.ts                     # Prisma client singleton
│   ├── store.ts                  # Zustand store — panel state + history
│   ├── streamProvider.ts         # NDJSON stream consumer per provider
│   └── types.ts                  # Shared TypeScript types
│
├── prisma/
│   ├── schema.prisma             # DB schema — provider configurable via env
│   └── dev.db                    # SQLite dev database (gitignored)
│
├── .env                          # Local secrets (gitignored)
├── .env.example                  # Template for local dev
└── .env.production.example       # Template for production deployment
```

---

## Setup Instructions

### Local Development

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd ai-model-playground
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and set VERCEL_AI_GATEWAY_KEY
   ```

4. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Production Deployment (Vercel)

1. Push your code to GitHub and import the repo in the Vercel dashboard.

2. Set environment variables in **Project → Settings → Environment Variables**:
   ```
   VERCEL_AI_GATEWAY_KEY   = <your gateway key>
   DATABASE_PROVIDER       = postgresql
   DATABASE_URL            = postgresql://user:pass@host:5432/dbname
   ```

3. Run migrations against your production database:
   ```bash
   DATABASE_PROVIDER=postgresql DATABASE_URL=<prod-url> npx prisma migrate deploy
   ```

4. Deploy — Vercel runs `npm run build` automatically.

---

## Database Configuration

Two environment variables control the database:

| Variable | Local dev | Production |
|---|---|---|
| `DATABASE_PROVIDER` | `sqlite` | `postgresql` |
| `DATABASE_URL` | `file:./dev.db` | `postgresql://...` |

SQLite is zero-config for development. PostgreSQL is recommended for production (Neon, Supabase, and Railway all work). The Prisma schema reads `DATABASE_PROVIDER` via `env()`, so no schema edits are needed when switching environments.

> **Note:** SQLite and PostgreSQL require separate migration histories. Run `prisma migrate dev` locally and `prisma migrate deploy` (with production env vars) for production.

---

## Adding a New Model

Add one entry to `lib/models.config.ts`. Everything else — the API route, Zustand store, all components, and cost calculations — picks it up automatically.

```ts
// lib/models.config.ts  ← the only file you touch
{
  id: 'google',
  label: 'Gemini 2.0 Flash',
  provider: 'Google',
  gatewayModel: 'google/gemini-2.0-flash',
  inputCostPer1M: 0.10,
  outputCostPer1M: 0.40,
  color: 'bg-yellow-900/60',
  textColor: 'text-yellow-400',
},
```

---

## Technical Decisions and Tradeoffs

### Config-Driven Providers vs Individual Files

**Chosen:** single `models.config.ts` with a `MODELS` array.

The previous approach had one file per provider, each duplicating the same `createOpenAI` + `streamText` boilerplate. Adding a model required touching 5+ files. The config approach collapses everything to one entry and makes cost and routing data inspectable in one place.

**Tradeoff:** individual files allow per-model customization (e.g. different system prompts, temperature). If needed, extend `ModelConfig` with optional fields.

### Single `/api/chat` vs `/api/compare`

**Chosen:** one generic `/api/chat` route called N times in parallel from the browser.

A single `/api/compare` route would need to fan out server-side, buffer or multiplex N streams, and handle partial failures in one handler. The parallel-fetch approach delegates concurrency to the browser (free) and keeps each stream simple and independent.

**Tradeoff:** N parallel HTTP requests vs one. In practice the difference is negligible with HTTP/2 multiplexing, and the simpler code path is worth it.

### SQLite Dev / PostgreSQL Prod

**Chosen:** `provider = env("DATABASE_PROVIDER")` in Prisma schema.

Zero setup for local development, production-grade persistence in deployment. The schema models are compatible across both providers.

**Tradeoff:** separate migration histories per provider. Keep them in sync by running `migrate deploy` on every production release.

### Zustand vs Redux / Context

**Chosen:** Zustand.

Minimal boilerplate, no Provider wrapping, built-in selector subscriptions that prevent unnecessary re-renders. For this app size, Redux's ceremony adds no value.

### Vercel AI Gateway vs Direct Provider Keys

**Chosen:** Vercel AI Gateway with a single key.

Managing separate API keys and billing accounts for four providers is operationally expensive. The gateway consolidates billing, adds observability, and lets you add providers without changing credentials.

**Tradeoff:** adds a network hop through Vercel's infrastructure and requires a Vercel account. For latency-sensitive workloads, direct keys may be faster.

---

## Future Improvements

- **Authentication** — User accounts so each user sees only their own history
- **Model parameters** — Expose temperature, max tokens, and system prompt per panel
- **Export** — Download comparison as PDF or generate a shareable link
- **Cost alerts** — Set a per-request budget; warn before submitting expensive prompts
- **Response ratings** — Thumbs up/down per model to track quality over time
- **Vision inputs** — Image upload support for multimodal-capable models
- **Diff view** — Highlight semantic differences between responses side by side
