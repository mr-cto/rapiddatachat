// eslint.config.mjs
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        project: true,
      },
    },
    plugins: {},
    rules: {}, // disables all rules
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
];
