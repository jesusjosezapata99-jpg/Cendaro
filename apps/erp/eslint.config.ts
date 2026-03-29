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
    // MFA pages display QR codes as data: URLs — next/image does not support
    // data: URI src values for security reasons. Bare <img> is intentional here.
    // settings/page.tsx: QR code during TOTP enrollment flow
    // login/mfa-setup/page.tsx: QR code during forced MFA setup
    files: ["**/settings/page.tsx", "**/login/mfa-setup/page.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      // mfa-setup useEffect intentionally omits supabase from deps to run only on mount
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
