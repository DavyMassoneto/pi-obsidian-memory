import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Os testes criam repositórios git temporários; no Windows isso é mais lento.
    testTimeout: 30_000,
  },
})
