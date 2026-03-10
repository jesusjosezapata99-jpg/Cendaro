import { defineConfig } from "eslint/config";

import { baseConfig } from "@cendaro/eslint-config/base";
import { reactConfig } from "@cendaro/eslint-config/react";

export default defineConfig(baseConfig, reactConfig);
