import { defineConfig } from "eslint/config";

import { baseConfig } from "@cendaro/eslint-config/base";

export default defineConfig(baseConfig, {
  ignores: [".agents/**", "_agents/**", ".agent/**", "_agent/**"],
});
