module.exports = {
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "tsconfig.json",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "header", "import", "sort-destructure-keys"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "root": true,
  "env": {
    "node": true,
    "jest": true
  },
  "ignorePatterns": [".eslintrc.js"],
  "rules": {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      {
        "accessibility": "no-public"
      }
    ],
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "complexity": [
      "error", 20],
    "curly": [
      "error", "multi-line"
    ],
    "default-case": "error",
    "eqeqeq": [
      "error", "always"
    ],
    "import/no-extraneous-dependencies": "off",
    "import/order": [
      "error",
      {
        "alphabetize": {
          "order": "asc" /* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */,
          "caseInsensitive": true /* ignore case. Options: [true, false] */
        }
      }
    ],
    "header/header": [2, "line", [
      {
        "pattern": " Copyright \\d{4}(-\\d{4})? SubQuery Pte Ltd authors & contributors",
        "template": " Copyright 2020-2022 SubQuery Pte Ltd authors & contributors" },
      " SPDX-License-Identifier: Apache-2.0"
    ], 2]
  }
}
