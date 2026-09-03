import type { FixupPluginDefinition } from "@eslint/compat";
import { fixupPluginRules } from "@eslint/compat";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export const reactConfig = defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  plugins: {
    react: fixupPluginRules(reactPlugin),
    "react-hooks": fixupPluginRules(
      hooksPlugin as unknown as FixupPluginDefinition,
    ),
  },
  rules: {
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    ...reactPlugin.configs.flat?.recommended?.rules,
    ...reactPlugin.configs.flat?.["jsx-runtime"]?.rules,
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
  languageOptions: {
    globals: {
      React: "writable",
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
});
