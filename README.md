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

### 3. Client-Driven Fan-Out (Parallel Orchestration)

To achieve simultaneous streaming, the app uses a client-side fan-out approach. The browser initiates a `Promise.allSettled` block, firing independent parallel `POST` requests to the `/api/chats` route for each model. This utilizes HTTP/2 multiplexing, preventing a slow model from blocking the execution of faster models.

### 4. The Facade / Gateway Pattern

By routing all LLM traffic through the Vercel AI Gateway using a single provider client, the app utilizes the Facade pattern. The underlying complexities of Anthropic, Google, and OpenAI's specific REST implementations are abstracted away behind a unified interface.

### Directory Tree

```text
ai-model-playground/
├── app/
│   ├── api/
│   │   ├── auth/                 # Controllers: Authentication endpoints
│   │   ├── chats/                # Controllers: Streaming chat API (NDJSON)
│   │   ├── comparisons/          # Controllers: Viewing/saving comparisons
│   │   └── ...                   # Controllers: cron, guest, shares
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
│   │   ├── chat/
│   │   │   ├── chat.dto.ts       # Prompt and provider validation
│   │   │   └── chat.service.ts   # AI streaming orchestration
│   │   └── comparisons/
│   │       ├── comparisons.dto.ts
│   │       ├── comparisons.service.ts
│   │       └── comparisons.repository.ts
│   ├── db.ts                     # Prisma client singleton
│   ├── models.config.ts          # Single source of truth for all models
│   └── store.ts                  # Zustand store for app state
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

## Technical Decisions and Tradeoffs

* **Config-Driven Providers vs Individual Files**
* **Chosen:** A single `models.config.ts` file acting as the source of truth for all models.
* **Tradeoff:** Individual files would allow for per-model custom logic, but the config approach drastically reduces boilerplate and makes adding new models a simple one-line array addition.


* **API Modularity and Strict Layers**
* **Chosen:** Layered backend architecture (`Controller -> DTO -> Service -> Repository`).
* **Tradeoff:** Requires more boilerplate upfront compared to writing monolithic Next.js route handlers, but ensures the codebase remains robust, testable, and strictly decoupled as it grows.


* **Single Chat Endpoint vs Batched Route**
* **Chosen:** A generic chat streaming route (`/api/chats`) called *N* times in parallel from the browser.
* **Tradeoff:** A server-side fan-out could reduce HTTP request overhead, but requires complex multiplexing to stream multiple responses back through a single connection. Client-side fan-out is highly resilient and delegates concurrency to the browser.


* **Zustand vs Context/Redux**
* **Chosen:** Zustand for global state management.
* **Tradeoff:** Minimal boilerplate without React Context Provider wrapping. Ideal for highly concurrent updates (streaming text into multiple panels) without triggering heavy top-level DOM re-renders.



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

* **Semantic Caching:** Implementing a vector database (`pgvector`) to cache responses based on the *meaning* of the prompt, bypassing the AI Gateway entirely for similar repeated queries.
* **Edge Caching:** Pushing static configurations to a CDN or Redis Edge layer.

### 5. Database Connection Pooling

Implementing **PgBouncer** alongside the Kubernetes cluster to manage database connections efficiently, preventing connection exhaustion during traffic spikes.
