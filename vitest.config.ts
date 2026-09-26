import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // Los tests E2E arrancan la app real (buildApp + crons) — dar margen a los hooks
    hookTimeout: 60_000,
    pool: "forks",
    env: {
      // Silencia pino en toda la suite (el E2E arranca la app completa)
      LOG_LEVEL: "silent",
      // Storage escribible en CI y en local (el default /data/erp-storage no existe)
      STORAGE_PATH: "/tmp/erp-storage-vitest",
    },
  },
});
