import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   serverExternalPackages: ["pdf-parse-new", "pg", "@prisma/adapter-pg"],
   turbopack: {
      root: __dirname,
   },
};

export default nextConfig;