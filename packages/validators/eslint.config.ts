import { defineConfig } from "eslint/config";

import { baseConfig } from "@cendaro/eslint-config/base";

export default defineConfig(baseConfig, {
  // Test files are excluded from tsconfig.json (build output)
  // so ESLint's projectService can't resolve them.
  ignores: ["src/__tests__/**"],
});
