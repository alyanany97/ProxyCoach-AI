# ProxyCoach AI

**ProxyCoach AI** is a **production** multi-tenant AI fitness platform in active use by **10+ personal trainers** at the **Guelph YMCA** and **50+ real users** (trainers and clients). It is not a demo or side project—the live product is depended on week to week for coaching workflows.

The goal is to give each trainer their own AI-powered assistant that understands their **training philosophy**, **nutrition approach**, and **client needs**—not generic fitness advice.

---

## Where it runs (production)

**ProxyCoach AI runs in production on Microsoft Azure**, on the **same deployment model** as the prior production service: **Docker** images pushed to **Azure Container Registry (ACR)**, deployed to **Azure Web App for Containers**, with **GitHub Actions** handling build and release (including Prisma migrations against the production database).

The **live application** is served over **HTTPS** at **`https://app.proxycoach.ai`** (illustrative production hostname for this deployment; custom domain and Azure default hostnames are configured in Azure as needed). Trainers and clients **do not** run the app locally; they use that hosted **Proxycoach** site in the browser, authenticated with **Microsoft Entra ID** (Azure AD).

Changes to this repository flow through CI/CD into that environment—treat every merge to the deployment branches as affecting **real users**.

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

## Production configuration (Azure)

Secrets and integration endpoints are set as **environment variables / App Settings** on the Azure Web App (and related resources), not checked into git. Typical groups maintained by operators:

- **Database** — `DATABASE_URL` (PostgreSQL)
- **Auth (Microsoft Entra ID)** — `AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID`, `AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`, plus `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL` (e.g. `https://app.proxycoach.ai` so OAuth redirects resolve correctly)
- **Auto-register domains (optional)** — `ALLOWED_AUTO_REGISTER_DOMAINS` — comma-separated email domains whose users can sign in without an invitation (e.g. YMCA domains). Leave unset if all access should go through invitations.
- **Blob storage** — `AZURE_STORAGE_CONNECTION_STRING` or account name + key (and optional container names)
- **Chat / LLM** — e.g. `AZURE_BASICLLM_OPENAI_TARGET_URL`, `AZURE_BASICLLM_OPENAI_API_KEY`, `AZURE_BASICLLM_DEPLOYMENT_NAME` (see `web-agents/src/app/api/`)
- **Search / embeddings** — `SEARCH_ENDPOINT`, `SEARCH_API_KEY`, index names, embedding endpoint and keys (see `web-agents/src/lib/azure-search.ts`)
- **Telemetry (optional)** — `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING`

Variable names and behavior are also documented inline under `web-agents/src`.

---

## Operations notes

- **Production deploys** — Migrations run in CI before the new container is deployed; coordinate schema changes with downtime or backward-compatible steps when **50+ users** are live.
- **Auth** — Entra app registration redirect URIs must include the production callback, e.g. `https://app.proxycoach.ai/api/auth/callback/azure-ad` (plus any real custom domain or Azure `*.azurewebsites.net` host you use in practice).
- **Cost and capacity** — Driven by OpenAI/search usage, index size, and Blob traffic; monitor Azure spend and App Service metrics for the YMCA workload.

---

## License and contact

This project is maintained for the Guelph YMCA trainer program. For access, deployment, or incident questions, contact alyanany07@gmail.com.
