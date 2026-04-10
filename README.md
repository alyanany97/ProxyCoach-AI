# ProxyCoach AI

**ProxyCoach AI** is a production, multi-tenant AI fitness platform built for **10+ personal trainers** at the **Guelph YMCA**. The goal is to give each trainer their own AI-powered assistant that understands their **training philosophy**, **nutrition approach**, and **client needs**—not generic fitness advice.

The application is **live in production** with **50+ active users**.

---

## What it does

- **Trainer-scoped assistants** — Each trainer works within an isolated tenant; the AI is grounded in *their* materials and preferences.
- **Client-ready workflows** — Trainers (and, where enabled, their clients) interact through a unified web experience backed by authenticated APIs.

---

## AI layer: three specialized RAG agents

Retrieval-Augmented Generation (RAG) powers three domain-specific agents:

| Agent | Focus |
|--------|--------|
| **Training coach** | Workout programming, exercise guidance, progression |
| **Nutrition advisor** | Dietary recommendations aligned with the trainer’s approach |
| **Recovery tracker** | Injury prevention, recovery planning, load management |

Each agent retrieves context from **trainer-specific knowledge** via **Azure AI Search** vector indexes. When someone asks a question, retrieval is limited to **that trainer’s uploaded content**—not other trainers’ data on the platform.

The AI stack is built on **Azure AI Foundry** and related Azure AI services, with embeddings and search wired through the application layer.

---

## Multi-tenancy and data isolation

- **Tenant-scoped vector search** — Azure AI Search indexes are used in a **per-trainer** (per-tenant) way so semantic retrieval never mixes corpora across tenants.
- **PostgreSQL + Prisma** — Application state, users, companies, conversations, files, and safety events are modeled in **11 Prisma models** against **PostgreSQL**, with tenant boundaries enforced in queries and domain logic.
- **Isolation guarantee** — Trainers operate as distinct tenants with **no cross-contamination** of knowledge-base content or client information between tenants.

---

## Safety

- A **38-term safety guardrail** evaluates queries for harmful or inappropriate content.
- Flagged interactions are **logged to PostgreSQL** for review and auditing, reducing the risk of dangerous or off-policy health advice being acted on blindly.

---

## Tech stack

| Layer | Technology |
|--------|-------------|
| **Frontend / backend** | [Next.js](https://nextjs.org), [TypeScript](https://www.typescriptlang.org) |
| **AI / RAG** | Azure AI Foundry, **Azure AI Search** (per-tenant vector indexes), Azure OpenAI–compatible endpoints |
| **Database** | **PostgreSQL** with [Prisma](https://www.prisma.io) ORM (**11 models**) |
| **Auth** | Microsoft Entra ID (Azure AD) via [NextAuth.js](https://next-auth.js.org) |
| **File storage** | **Azure Blob Storage** |
| **Telemetry** | Azure Application Insights (optional, client init) |
| **Serverless / automation** | **Azure Functions** (supporting workflows) |

---

## Infrastructure and delivery

- **Containers** — The web app is **Docker**-image based (`web-agents/dockerfile`).
- **Registry** — Images are pushed to **Azure Container Registry (ACR)**.
- **CI/CD** — **GitHub Actions** (see `.github/workflows/`) builds and deploys to **Azure Web App for Containers** (separate workflows for develop and production branches).
- **Runtime** — Node **20**-based images; Prisma migrations run in the pipeline against the target database.

---

## Repository layout

```
proxycoach-app/
├── .github/workflows/     # Build, Docker, deploy to Azure Web App
├── web-agents/            # Next.js application (main codebase)
│   ├── prisma/            # Schema & migrations
│   ├── src/               # App router, API routes, components, lib
│   ├── dockerfile         # Production container build
│   └── package.json
└── README.md              # This file
```

---

## Local development

Prerequisites: **Node.js** `>=20.19` (or supported 22.x / 24.x per `package.json` engines), **PostgreSQL**, and Azure-backed resources (or compatible dev substitutes) for auth, storage, and AI.

```bash
cd web-agents
npm install --legacy-peer-deps
# Create .env.local with DATABASE_URL, auth, storage, and AI-related variables (see below)
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production-like run:

```bash
npm run build
npm start
```

---

## Configuration (environment variables)

The app expects secrets and endpoints via environment variables. Typical groups:

- **Database** — `DATABASE_URL` (PostgreSQL)
- **Auth (Microsoft Entra ID)** — `AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID`, `AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`, plus `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL`
- **Auto-register domains (optional)** — `ALLOWED_AUTO_REGISTER_DOMAINS` — comma-separated list of email domains whose users can sign in without an invitation (e.g. `guelphymca.ca,ymca.ca`). Leave unset to require invitations for all users except existing DB users handled elsewhere.
- **Blob storage** — `AZURE_STORAGE_CONNECTION_STRING` or `AZURE_STORAGE_ACCOUNT_NAME` + `AZURE_STORAGE_ACCOUNT_KEY` (and optional container names)
- **Chat / LLM** — e.g. `AZURE_BASICLLM_OPENAI_TARGET_URL`, `AZURE_BASICLLM_OPENAI_API_KEY`, `AZURE_BASICLLM_DEPLOYMENT_NAME` (see API routes under `src/app/api/`)
- **Search / embeddings** — `SEARCH_ENDPOINT`, `SEARCH_API_KEY`, index names, Azure OpenAI embedding endpoint and keys (see `src/lib/azure-search.ts`)
- **Telemetry (optional)** — `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING`

Concrete variable names and comments also appear next to usage in `web-agents/src`. For a starter template focused on storage and OpenAI, see `web-agents/README.md`.

---

## Operations notes

- Run **Prisma migrations** (`prisma migrate deploy`) against the target database before or as part of deploys; CI already does this for configured environments.
- **Auth redirect URIs** in Entra ID must match your deployed URL (e.g. `https://<host>/api/auth/callback/azure-ad`).
- Scaling and cost are primarily driven by **OpenAI/search usage**, **search index size**, and **Blob** egress/storage.

---

## License and contact

This project is maintained for the Guelph YMCA trainer program. For access, deployment, or incident questions, contact alyanany07@gmail.com.
