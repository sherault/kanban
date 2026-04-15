import baseConfig from "@kanban/eslint-config";

import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      ".next/**",
      "postcss.config.cjs",
      "postcss.config.js",
      "next.config.mjs",
      "eslint.config.js",
    ],
  },
  ...baseConfig,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
