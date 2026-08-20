import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@minikb/ui": new URL(".", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/ui/**/*.test.ts", "components/ui/**/*.test.tsx"],
  },
});
