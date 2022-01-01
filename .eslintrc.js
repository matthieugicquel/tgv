module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['import', 'simple-import-sort'],
  extends: [],
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'import/extensions': ['error', 'ignorePackages'],
  },
};
