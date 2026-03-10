import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@cendaro/eslint-config/base";
import { nextjsConfig } from "@cendaro/eslint-config/nextjs";
import { reactConfig } from "@cendaro/eslint-config/react";

export default defineConfig(
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
