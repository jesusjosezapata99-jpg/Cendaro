import { baseConfig, restrictEnvAccess } from "@cendaro/eslint-config/base";
import { nextjsConfig } from "@cendaro/eslint-config/nextjs";
import { reactConfig } from "@cendaro/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
