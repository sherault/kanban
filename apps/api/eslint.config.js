import baseConfig from "@kanban/eslint-config";

export default [
  // Must be its own object: a config object with `ignores` alongside other
  // keys only scopes that object, it does not globally exclude the files.
  {
    ignores: ["dist/**", "drizzle/**", "*.config.ts", "eslint.config.js"],
  },
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
