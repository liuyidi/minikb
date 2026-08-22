import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const apiOrigin = process.env.MINIKB_API_URL ?? "http://127.0.0.1:8080";
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@minikb/ui", "@minikb/chat"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiOrigin}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
