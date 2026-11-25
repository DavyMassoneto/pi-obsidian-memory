import { setFlagsFromString } from "node:v8"
import { runInNewContext } from "node:vm"

import type { createLocalEmbedder } from "#src/services"

export async function loadEmbedderFactory(): Promise<typeof createLocalEmbedder> {
  const { createJiti } = await import("jiti")
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false })
  const { createLocalEmbedder: factory } = await jiti.import<typeof import("../../src/services/embeddings/local.ts")>(
    "../../src/services/embeddings/local.ts",
  )
  return factory
}

export function collectedHeapMiB(): number {
  setFlagsFromString("--expose-gc")
  try {
    runInNewContext("gc()")
  } finally {
    setFlagsFromString("--no-expose-gc")
  }
  return process.memoryUsage().heapUsed / 1024 ** 2
}
