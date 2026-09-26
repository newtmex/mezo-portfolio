import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo: point Turbopack at the workspace root so `next` resolves via pnpm.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
