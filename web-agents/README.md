# ProxyCoach AI — Web application

This directory contains the **Next.js** application for [ProxyCoach AI](../README.md).

## Quick start

```bash
npm install --legacy-peer-deps
# Configure .env.local (see parent README and variable usage in src/)
npx prisma migrate deploy && npx prisma generate
npm run dev
```

**Node.js:** `>=20.19`, or supported `22.12+` / `24+` per `package.json` `engines`.

For architecture, multi-tenancy, AI agents, and deployment, see the [project README](../README.md).

## Environment variables

Create `.env.local` in this folder. You will need at minimum PostgreSQL (`DATABASE_URL`), Microsoft Entra ID credentials for NextAuth, Azure Blob Storage for uploads, and Azure OpenAI / search settings for chat and RAG. Optional: `ALLOWED_AUTO_REGISTER_DOMAINS` (comma-separated email domains for sign-in without an invitation). See inline documentation in `src/lib/` (e.g. `blob-storage.ts`, `azure-search.ts`) and API routes under `src/app/api/`.

Example snippets for storage:

```bash
# Azure Blob — connection string (recommended)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
# Optional: AZURE_STORAGE_CONTAINER_NAME=chat-files
```

For OpenAI keys and endpoints, use the Azure Portal: OpenAI resource → **Keys and Endpoint** and **Deployments**.
