import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Evitar que Prisma falle en serverless (Vercel)
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
