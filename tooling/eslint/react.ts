import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export const reactConfig = defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  plugins: {
    react: reactPlugin,
    "react-hooks": hooksPlugin,
  },
  rules: {
    ...reactPlugin.configs.flat.recommended.rules,
    ...reactPlugin.configs.flat["jsx-runtime"].rules,
    ...hooksPlugin.configs.recommended.rules,
  },
  languageOptions: {
    globals: {
      React: "writable",
    },
  },
});
