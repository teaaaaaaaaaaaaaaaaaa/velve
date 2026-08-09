module.exports = {
  extends: ['universe/native', 'universe/shared/typescript-analysis'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // `void somePromise()` is the intentional fire-and-forget idiom used
    // throughout the codebase (analytics, prefetch) — allow it as a statement.
    'no-void': ['warn', { allowAsStatement: true }],
  },
};
