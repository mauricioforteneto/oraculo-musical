import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e", use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run start -- --port 3100", url: "http://localhost:3100/login",
    reuseExistingServer: false,
    env: { APP_ORIGIN: "http://localhost:3100", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", OWNER_USER_ID: "" },
  },
});
