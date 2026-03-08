import { baseConfig } from "@cendaro/eslint-config/base";
import { reactConfig } from "@cendaro/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(baseConfig, reactConfig);
