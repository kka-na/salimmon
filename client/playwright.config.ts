import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// E2E runs both processes against the test-only sample dataset and a throwaway DB.
// Stop any `next dev` already running in this directory first (one dev server per .next).
const API_PORT = 8100;
const WEB_PORT = 3100;
const db = path.join(os.tmpdir(), `salimmon-e2e-${Date.now()}.db`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices["Pixel 7"],
    viewport: { width: 360, height: 780 },
    locale: "ko-KR",
  },
  webServer: [
    {
      command: `env -u PYTHONPATH RESEARCH_DIR=samples/research DATABASE_URL=sqlite:///${db} .venv/bin/uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../server",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      env: { API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NEXT_PUBLIC_KAKAO_MAP_APP_KEY: "" },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
