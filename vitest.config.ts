import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The tests create temporary git repositories, which is slow on Windows.
    testTimeout: 30_000,
  },
})
