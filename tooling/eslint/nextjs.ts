import { defineConfig } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";

export const nextjsConfig = defineConfig({
  plugins: {
    "@next/next": nextPlugin,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
});
