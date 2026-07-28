import baseConfig from "./packages/eslint-config/index.js";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".turbo/**",
      "apps/web/.next/**",
      "apps/api/drizzle/migrations/**",
      // Build/tool config files live outside every tsconfig `include`, so
      // typed linting cannot resolve a program for them.
      "**/*.config.ts",
    ],
  },
  ...baseConfig,
  // Node scripts and CommonJS config files: plain JS, Node globals.
  {
    files: ["scripts/**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
      },
    },
  },
  // API settings
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./apps/api/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Web settings
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
    languageOptions: {
      parserOptions: {
        project: "./apps/web/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Shared settings
  {
    files: ["packages/shared/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./packages/shared/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
