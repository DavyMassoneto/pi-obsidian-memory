import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    maxWorkers: 8,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/**/*.model.test.ts", "tests/e2e/**"],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "model",
          include: ["tests/**/*.model.test.ts"],
          testTimeout: 600_000,
        },
      },
      {
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.e2e.test.ts"],
          exclude: ["tests/e2e/**/*.laya.e2e.test.ts"],
          fileParallelism: false,
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
      {
        test: {
          name: "e2e-laya",
          include: ["tests/e2e/**/*.laya.e2e.test.ts"],
          fileParallelism: false,
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
    ],
  },
})
