# AI Model Playground

This application is a side-by-side AI model comparison tool that streams responses from multiple providers simultaneously. It displays real-time latency, token counts, and cost estimates for each model, allowing developers and users to benchmark LLM performance instantly.

## Project Structure and Architecture

The application is built on a highly modular, modern Next.js stack, leveraging several key architectural patterns to handle concurrent AI streaming efficiently:

### 1. Serverless Backend-for-Frontend (BFF)

The Next.js `app/api/` routes act as a BFF. Instead of the React frontend communicating directly with third-party AI APIs or the database, it talks strictly to these internal routes. This secures API keys (`VERCEL_AI_GATEWAY_KEY`, `JWT_SECRET`), shapes the data precisely for the frontend, and currently scales automatically via Vercel's serverless infrastructure.

### 2. Strict Layered Architecture (Controller-DTO-Service-Repository)

The backend enforces a strict separation of concerns, ensuring business logic is isolated and testable:

* **Controllers (`app/api/`):** Route handlers that parse incoming HTTP requests and return HTTP responses or NDJSON streams.

* **DTOs (`lib/modules/.../dto.ts`):** Data Transfer Objects that validate and strongly type the incoming payloads (e.g., using Zod) before handing them off.

* **Services (`lib/modules/.../service.ts`):** The core business logic layer. Services orchestrate the application's rules, handle AI interactions, and manage state without knowing about HTTP or raw SQL.

* **Repositories (`lib/modules/.../repository.ts`):** The data access layer. Repositories interact directly with the Prisma client (`lib/db.ts`) to execute database queries.

### 3. Server-Controlled Multiplexed Streaming

The application uses a server-side multiplexed streaming approach (`/api/comparisons`). Instead of the frontend acting as a workflow engine that coordinates multiple AI models, the backend takes full ownership of the orchestration. The client simply receives a unified stream of NDJSON events. This strictly enforces the Separation of Concerns: the backend orchestrates multi-model inference, and the frontend only renders the results.

### 4. The Facade / Gateway Pattern

By routing all LLM traffic through the Vercel AI Gateway using a single provider client, the app utilizes the Facade pattern. The underlying complexities of Anthropic, Google, and OpenAI's specific REST implementations are abstracted away behind a unified interface.

### Directory Tree

```text
ai-model-playground/
├── app/
│   ├── api/
│   │   ├── auth/                 # Controllers: Authentication endpoints
│   │   ├── comparisons/          # Controllers: Multiplexed streaming & saving
│   │   ├── guests/               # Controllers: Guest session creation
│   │   └── ...                   # Controllers: cron, shares
│   ├── layout.tsx                
│   └── page.tsx                  
│
├── components/
│   ├── CompareLayout.tsx         # Responsive grid of model panels + sync scroll
│   ├── MetricsComparison.tsx     # Cost, token, and latency data tables
│   └── ...
│
├── lib/
│   ├── modules/                  # Domain-Driven Modules
│   │   ├── auth/
│   │   │   ├── auth.dto.ts       # Validation schemas for login/register
│   │   │   ├── auth.service.ts   # Business logic (hashing, JWT signing)
│   │   │   └── auth.repository.ts# User DB queries
│   │   ├── comparison/
│   │   │   ├── compare.dto.ts    # Public API request validation (Zod)
│   │   │   ├── comparison.service.ts # fanOut + stream orchestration
│   │   │   ├── buildMultiplexedStream.ts # Concurrent NDJSON fan-out
│   │   │   ├── buildNdjsonStream.ts      # Single-provider stream builder
│   │   │   └── ndjsonCodec.ts    # NDJSON frame types, encoder, parser
│   │   └── history/
│   │       ├── history.dto.ts    # Schemas for saving/fetching comparisons
│   │       ├── history.service.ts
│   │       └── history.repository.ts
│   ├── auth.ts                   # JWT helpers + cookie setters/clearers
│   ├── route-guards.ts           # withAuth / withGuestLimit HOF middleware
│   ├── compareStream.ts          # Client-side NDJSON stream consumer
│   ├── db.ts                     # Prisma client singleton
│   ├── models.config.ts          # Single source of truth for all models
│   └── store.ts                  # Zustand store for app state
│
├── __tests__/
│   ├── components/               # Unit tests: UI components (Vitest + RTL)
│   │   ├── AuthModal.test.tsx
│   │   ├── HistoryDrawer.test.tsx
│   │   ├── MetricsBadge.test.tsx
│   │   └── UpgradeBanner.test.tsx
│   ├── api/                      # Unit tests: API route handlers
│   └── lib/                      # Unit tests: services, repositories, utilities
│
├── e2e/                          # End-to-end tests (Playwright / Chromium)
│   ├── auth.spec.ts              # Registration, login, logout flows
│   ├── compare.spec.ts           # Prompt input, model panels, history drawer
│   ├── guest.spec.ts             # Guest session behaviour
│   ├── history.spec.ts           # History drawer open/close, empty state
│   └── settings.spec.ts          # Settings panel sliders
│
├── .github/
│   └── workflows/
│       └── ci.yml                # CI: lint → unit tests → E2E → deploy
│
└── prisma/
    └── schema.prisma             # DB schema (PostgreSQL)

```

## Setup Instructions

### Local Development

1. **Clone the repository**
```bash
git clone <repo-url>
cd ai-model-playground

```


2. **Install dependencies**
```bash
npm install

```


3. **Configure environment variables**
```bash
cp .env.example .env

```


*Edit `.env` and provide your database connection string, JWT secret, and `VERCEL_AI_GATEWAY_KEY`.*
4. **Run database migrations**
```bash
npx prisma migrate dev

```


5. **Start the development server**
```bash
npm run dev

```


*Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your browser.*

### Production Deployment (Vercel)

1. Push your code to GitHub and import the repository into your Vercel dashboard.
2. Set the following environment variables in **Project → Settings → Environment Variables**:
* `VERCEL_AI_GATEWAY_KEY`
* `DATABASE_PROVIDER` (e.g., `postgresql`)
* `DATABASE_URL` (e.g., `postgresql://user:pass@host:5432/dbname`)
* `JWT_SECRET`


3. Run migrations against your production database:
```bash
DATABASE_PROVIDER=postgresql DATABASE_URL=<prod-url> npx prisma migrate deploy

```


4. Deploy the application. Vercel will automatically run `npm run build`.

## Testing

The project has two layers of automated tests: **unit tests** (fast, no network) and **end-to-end tests** (full browser + real database).

### Unit Tests — Vitest + React Testing Library

Unit tests cover API route handlers, domain services, repositories, and UI components. They run entirely in-process with no external dependencies.

```bash
npm test              # run once
npm run test:watch    # watch mode
```

**Coverage (~164 tests):**

| Area | What is tested |
|---|---|
| `__tests__/api/` | Route handlers (auth, comparisons, guest, shares) |
| `__tests__/lib/modules/` | Auth service/repo, comparison service, history service/repo |
| `__tests__/lib/` | `models.config`, cost calculation, token formatting |
| `__tests__/components/` | `MetricsBadge`, `UpgradeBanner`, `AuthModal`, `HistoryDrawer` |

### End-to-End Tests — Playwright (Chromium)

E2E tests run against a locally built production server (`npm run build && npm start`) connected to the real Supabase database. All tests use a fresh registered user per test file, and streaming tests are skipped because they require live AI gateway traffic.

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode (step-through debugger)
```

**Coverage (51 tests, 2 skipped):**

| Spec | What is tested |
|---|---|
| `auth.spec.ts` | Page load without modal, login form validation, register, login, logout |
| `compare.spec.ts` | Prompt textarea, Compare button state, character count, model subtitle, history drawer |
| `guest.spec.ts` | Guest session: no modal, no logout button, prompt accessible, upgrade banner threshold |
| `history.spec.ts` | Trigger button, drawer open/close, Escape key, empty state (guest + authed), share 404 |
| `settings.spec.ts` | Panel toggle, temperature slider, max-tokens slider, keyboard interaction, persistence |

> **Database note:** E2E tests create real user accounts (`auth-*@example.com`, `compare-*@example.com`, etc.) in Supabase using `Date.now()`-suffixed emails to prevent conflicts across runs.

### CI / CD — GitHub Actions

Every push to `main` and every pull request runs three parallel jobs before anything is deployed:

```
push / PR
    │
    ├── Lint ──────────────────────┐
    ├── Unit Tests ────────────────┼──► Deploy to Vercel  (main branch only,
    └── E2E Tests ─────────────────┘    after all three pass)
```

The workflow lives in `.github/workflows/ci.yml`. Required GitHub Secrets:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Supabase pgbouncer URL (port 6543) with `&pgbouncer=true` |
| `POSTGRES_URL` | Supabase direct URL (port 5432) |
| `JWT_SECRET` | Token signing secret |
| `VERCEL_AI_GATEWAY_KEY` | Vercel AI gateway API key |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel user ID (personal accounts) or team ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

If a Playwright run fails in CI, the `test-results/` directory is uploaded as a workflow artifact (retained for 7 days) so you can inspect screenshots and traces.



* **Config-Driven Providers vs Individual Files**
 **Chosen:** A single `models.config.ts` file acting as the source of truth for all models.
 **Tradeoff:** Individual files would allow for per-model custom logic, but the config approach drastically reduces boilerplate and makes adding new models a simple one-line array addition.


* **API Modularity and Strict Layers**
 **Chosen:** Layered backend architecture (`Controller -> DTO -> Service -> Repository`).
 **Tradeoff:** Requires more boilerplate upfront compared to writing monolithic Next.js route handlers, but ensures the codebase remains robust, testable, and strictly decoupled as it grows.


* **Single Multiplexed Stream vs Multiple Independent Streams**
 Chosen: A single `/api/comparisons` endpoint that multiplexes 3 AI streams into one connection.
 Tradeoff: Managing 3 independent streams from the client (`/api/chats?model=X`) is simpler to debug, observable in the network tab, and allows for independent retries. However, for a product where the *core feature* is model comparison, multiplexing enforces that the backend orchestrates the multi-model workflow rather than treating the frontend as a workflow engine. It strictly separates concerns: backend orchestrates, frontend renders.


* **Server-Side Session Hydration vs Client Fetching**
 Chosen: Hydrating the initial session and guest state via a Server Component (`app/page.tsx`) and injecting it into the Zustand store on first render.
 Tradeoff: It requires reading cookies on the server (`next/headers`) and securely mutating the client store during initialization. However, this RESTful approach completely eliminates layout shift, reduces "waterfall" network fetches on initial load for returning visitors, and ensures the `POST /api/guests` endpoint is only ever called for genuinely new users.


* **Zustand vs Context/Redux**
 **Chosen:** Zustand for global state management.
 **Tradeoff:** Minimal boilerplate without React Context Provider wrapping. Ideal for highly concurrent updates (streaming text into multiple panels) without triggering heavy top-level DOM re-renders.



## Future Improvements (Enterprise Scale & High Traffic)

As the application scales beyond standard serverless limits, the following architectural evolutions are planned to handle high concurrency, persistent connections, and user tracking:

### 1. Kubernetes & Dedicated API Gateway

Moving away from transient serverless functions to a containerized **Kubernetes (K8s)** setup. A dedicated API Gateway (e.g., Kong or an Ingress controller) will handle routing, rate-limiting, and managing long-lived connections (WebSockets/SSE) far more effectively than serverless constraints allow.

### 2. Analytics & Guest Tracking via PostHog

Currently, guest sessions are tracked using a rudimentary combination of an `isGuest` boolean and a randomly generated ID stored in the database.

* **Improvement:** Migrate guest tracking and telemetry to **PostHog**. This will provide robust device fingerprinting, session replay, and deeper product analytics without cluttering the primary PostgreSQL database with anonymous user states.

### 3. Asynchronous Message Queues (Claim Ticket Pattern)

Instead of holding open `POST` requests while waiting for the AI Gateway, the architecture will shift to an asynchronous queue (e.g., Redis / BullMQ) processed by dedicated worker pods.

* The client sends a `POST` payload and immediately receives a `jobId`.
* The client connects via WebSocket or SSE using the `jobId` to receive the real-time stream safely.

### 4. Advanced Caching Layer

* **Edge Caching:** Pushing static configurations to a CDN or Redis Edge layer.
