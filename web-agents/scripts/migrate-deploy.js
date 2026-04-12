#!/usr/bin/env node
/**
 * Runs `prisma migrate deploy` using DIRECT_DATABASE_URL if set,
 * otherwise falls back to DATABASE_URL.
 *
 * Neon's pooler (PgBouncer) times out on advisory locks that Prisma
 * migrations require. The direct connection URL bypasses the pooler.
 */
const { execSync } = require("child_process");

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("Error: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set.");
  process.exit(1);
}

console.log(
  `Running prisma migrate deploy with ${
    process.env.DIRECT_DATABASE_URL ? "DIRECT_DATABASE_URL" : "DATABASE_URL"
  }`
);

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
