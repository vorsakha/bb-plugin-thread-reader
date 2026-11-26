import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["dist/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
  },
  {
    files: ["**/*.{js,ts,tsx}"],
    plugins: { "@stylistic": stylistic },
    rules: {
      curly: ["error", "all"],
      "no-nested-ternary": "error",
      "@stylistic/max-statements-per-line": ["error", { max: 1 }],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["if", "for", "while", "do", "switch", "try", "return", "throw"] },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "function" },
        { blankLine: "always", prev: "function", next: "*" },
      ],
    },
  },
);
