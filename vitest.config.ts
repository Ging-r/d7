import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      UPLOAD_DIR: "./.test-uploads",
      PLATFORM_FEE_PERCENT: "10",
      STRIPE_SECRET_KEY: "",
    },
    // The integration tests share one SQLite file.
    fileParallelism: false,
  },
});
