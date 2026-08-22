import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@minikb/chat": new URL(".", import.meta.url).pathname,
      "@minikb/ui": new URL("../ui", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
});
