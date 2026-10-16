import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import type { CatalogHit, MemoryScope } from "#src/services"
import type { SearchMemoryResult } from "#src/usecases"
import { memoryReadFixture } from "./memory-read.ts"
import { frontmatterLinesWith, noteText } from "./note.ts"
import { writeRegistrationSnapshot } from "./registration-usecases.ts"

export async function searchFixture() {
  const fixture = await memoryReadFixture()
  const project = { path: join(fixture.root, "loja-vault"), limits: fixture.config.limits }
  await mkdir(project.path)
  const config = {
    ...fixture.config,
    projects: [{ name: "loja", folder: fixture.context.workingFolder, vault: project.path }],
  }
  await writeRegistrationSnapshot(fixture.context, JSON.stringify(config))
  return { ...fixture, config, project }
}

export function noteWithId(number: number, body: string, extraLines: string[]): string {
  const id = `01JABCDE7XKQ2M9V3RTN8WPZ${number.toString(16).toUpperCase().padStart(2, "0")}`
  return noteText([...frontmatterLinesWith(`id: ${id}`), ...extraLines], body)
}

export function searchedHits(result: SearchMemoryResult, vault: MemoryScope): CatalogHit[] {
  if (!result.succeeded) throw new Error(result.problems.join("\n"))
  const found = result.output.vaults.find((entry) => entry.vault === vault)
  if (!found || !("hits" in found)) throw new Error(`no hits for ${vault}`)
  return found.hits
}
