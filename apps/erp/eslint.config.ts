import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@cendaro/eslint-config/base";
import { nextjsConfig } from "@cendaro/eslint-config/nextjs";
import { reactConfig } from "@cendaro/eslint-config/react";

export default defineConfig(
  { ignores: ["video/**"] },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
  {
    // OG/Twitter image routes use bare <img> for server-side rendering compatibility
    files: ["**/opengraph-image.tsx", "**/twitter-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Material Symbols is an icon font not loadable via next/font;
    // root layout applies globally (not a single-page concern).
    files: ["**/app/layout.tsx"],
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
);
