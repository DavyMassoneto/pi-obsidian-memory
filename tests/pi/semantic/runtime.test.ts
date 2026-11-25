import { join } from "node:path"

import { expect, test } from "vitest"

import { SemanticRuntime } from "#src/pi"
import { useTempFolder } from "#test-helpers"

const local = { provider: "local", model: "Xenova/multilingual-e5-small" } as const

test("the local model is used before any session is attached", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))

  const port = await runtime.source(local)
  await runtime.shutdown()

  expect(port).toMatchObject({ available: true })
})

test("concurrent local lookups in one session return the same port", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  try {
    const [first, second] = await Promise.all([runtime.source(local), runtime.source(local)])
    expect(first).toMatchObject({ available: true })
    expect(second).toBe(first)
  } finally {
    await runtime.shutdown()
  }
})
