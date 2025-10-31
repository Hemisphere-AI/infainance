module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': 'warn',
  },
  overrides: [
    {
      files: ['netlify/functions/**/*.js', '**/*.test.js', 'test-*.js', 'server.js'],
      env: { node: true, browser: false },
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^context$|^_', varsIgnorePattern: '^_' }],
      },
    },
  ],
}
