module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
    'plugin:jest/recommended',
    'plugin:jest/style',
    'plugin:jsdoc/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: ['json', 'import', 'jsdoc', 'jest'],
  ignorePatterns: ['/*', '!src'],
  rules: {
    'require-jsdoc': 0, // jsdoc is not mandatory on functions
    // disable eslint jsdoc internal check, already done by "jsdoc" plugin
    'valid-jsdoc': 0,
    'max-len': 0, // disable max length check of code lines
  },
  settings: {
    jsdoc: {
      preferredTypes: {
        object: 'Object',
      },
    },
  },
};
