# ProxyCoach AI — Web application

This directory contains the **Next.js** source for [ProxyCoach AI](../README.md).

**Production** runs on **Azure** (Docker → ACR → Web App for Containers). End users hit the live app at **`https://app.proxycoach.ai`** (documented example hostname)—see the [project README](../README.md) for architecture and operations.

---

## Maintainers (optional local checkout)

If you need a **local** checkout for debugging, use Node `>=20.19` (or supported `22.12+` / `24+` per `package.json` `engines`), create `.env.local` mirroring production secrets (never commit real values), then `npm install --legacy-peer-deps`, `npx prisma migrate deploy && npx prisma generate`, and `npm run dev`. Production behavior and URLs remain defined in Azure and the main README.

Environment variable categories match **Azure App Service** settings: database, Entra ID, Blob, OpenAI/search, optional `ALLOWED_AUTO_REGISTER_DOMAINS`. See `src/lib/` (e.g. `blob-storage.ts`, `azure-search.ts`) and `src/app/api/` for names and usage.
