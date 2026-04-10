import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   serverExternalPackages: ["pdf-parse-new"],
   turbopack: {
      root: __dirname,
   },
};

export default nextConfig;