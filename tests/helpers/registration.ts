import { mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { MemoryConfig } from "#/domain"

export async function registrationFixture() {
  const root = await mkdtemp(join(tmpdir(), "memory-registration-"))
  const config: MemoryConfig = {
    global: { vault: join(root, "global") },
    projects: [{ name: "project", folder: join(root, "work"), vault: join(root, "project") }],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
  await mkdir(config.global.vault)
  await mkdir(join(root, "project"))
  return { root, config, path: join(root, "machine", "config.json"), indexPath: join(root, "machine", "index") }
}
