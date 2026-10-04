import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { onTestFinished } from "vitest"

export async function useTempVault(): Promise<string> {
  const vault = await mkdtemp(join(tmpdir(), "vault-"))
  onTestFinished(() => rm(vault, { recursive: true, force: true }))
  return vault
}
