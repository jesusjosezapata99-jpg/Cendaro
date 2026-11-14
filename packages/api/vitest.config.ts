import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: path.resolve(__dirname, "../../"),
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "test/**/*.test.ts",
      "packages/api/test/**/*.test.ts",
      "packages/api/src/**/*.test.ts",
    ],
    setupFiles: [path.resolve(__dirname, "./src/test-setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/modules/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
    testTimeout: 10000,
  },
});
