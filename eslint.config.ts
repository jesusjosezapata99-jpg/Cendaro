import { defineConfig } from "eslint/config";

import { baseConfig, disableTypeChecked } from "@cendaro/eslint-config/base";

export default defineConfig(
  baseConfig,
  {
    ignores: [".agents/**", "_agents/**", ".agent/**", "_agent/**"],
  },
  {
    files: ["scripts/**/*.js"],
    extends: [disableTypeChecked],
  },
  {
    files: ["scripts/**/*.k6.js"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
      },
    },
  },
);
