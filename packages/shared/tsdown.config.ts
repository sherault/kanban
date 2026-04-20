import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  // In 2026, tsdown handles the ESM extension mapping
  // automatically to ensure compatibility with Node.js ESM.
});
