import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, readlink } from "node:fs/promises"
import { join } from "node:path"

import type { MemoryConfig } from "#src/services"
import { registrationUsecaseFixture, writeRegistrationSnapshot } from "./registration-usecases.ts"

export async function memoryReadFixture() {
  const fixture = await registrationUsecaseFixture()
  const config: MemoryConfig = fixture.config
  await mkdir(config.global.vault)
  await mkdir(fixture.context.workingFolder)
  await writeRegistrationSnapshot(fixture.context, JSON.stringify(config))
  return { ...fixture, config, vault: { path: config.global.vault, limits: config.limits } }
}

export async function memoryReadTree(root: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink()) result.push(`${entry.name}:link:${await readlink(path)}`)
    else if (entry.isDirectory()) {
      result.push(`${entry.name}/`)
      for (const child of await memoryReadTree(path)) result.push(`${entry.name}/${child}`)
    } else {
      const hash = createHash("sha256")
        .update(await readFile(path))
        .digest("hex")
      result.push(`${entry.name}:${hash}`)
    }
  }
  return result.sort()
}
