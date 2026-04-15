import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
    alias: {
      "@kanban/shared": new URL(
        "../../packages/shared/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
