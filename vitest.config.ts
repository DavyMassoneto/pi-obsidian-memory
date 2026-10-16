import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    maxWorkers: 8,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/**/*.smoke.test.ts", "tests/**/*.model.test.ts"],
        },
      },
      {
        test: {
          name: "pi",
          include: ["tests/**/*.smoke.test.ts"],
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
    ],
  },
})
