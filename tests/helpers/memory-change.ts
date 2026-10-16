import { join } from "node:path"

import { expect } from "vitest"

import type { MemoryScope } from "#src/services"
import { getMemory } from "#src/usecases"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export const READIED_PATH = "tools/Use pnpm.md"

export async function changeFixture() {
  const fixture = await searchFixture()
  const read = (vault: MemoryScope, path: string) =>
    getMemory({ vault, path, sourceCallId: `get-${path}` }, fixture.context)
  return { ...fixture, read }
}

export async function readiedNote(body: string, extraLines: string[]) {
  const fixture = await changeFixture()
  await putCatalogFile(fixture.vault, READIED_PATH, noteWithId(1, body, extraLines))
  expect((await fixture.read("global", READIED_PATH)).succeeded).toBe(true)
  return { ...fixture, file: join(fixture.vault.path, READIED_PATH) }
}
