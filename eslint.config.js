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
    ],
  },
  ...baseConfig,
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
    files: ["packages/shared/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./packages/shared/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
