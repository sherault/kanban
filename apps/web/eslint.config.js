import baseConfig from '@kanban/eslint-config'

export default [
  { ignores: ['.next/**', 'postcss.config.cjs', 'postcss.config.js', 'next.config.mjs', 'eslint.config.js'] },
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]
