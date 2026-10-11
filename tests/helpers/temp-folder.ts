import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { onTestFinished } from "vitest"

export async function useTempFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "pi-memory-test-"))
  onTestFinished(() => rm(folder, { recursive: true, force: true }))
  return folder
}
