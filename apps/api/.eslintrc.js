module.exports = {
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
  },
};
