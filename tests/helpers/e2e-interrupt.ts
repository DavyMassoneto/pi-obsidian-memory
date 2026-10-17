import { setTimeout as sleep } from "node:timers/promises"

import { searchPrompt } from "./e2e-semantic.ts"
import { writeVaultFile } from "./e2e-vault.ts"
import { storedChunkCountWhileRunning } from "./e2e-vectors.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const POLL_INTERVAL_MS = 20

export async function fillGlobalVault(world: Pick<E2eWorld, "folders">, count: number): Promise<void> {
  for (let number = 1; number <= count; number++) {
    await writeVaultFile(
      world.folders.globalVault,
      `notes/Note ${number}.md`,
      noteWithId(number, `Plain words number ${number} about the ordinary life of a person.`, []),
    )
  }
}

export async function beginSearch(world: Pick<E2eWorld, "pi">, query: string): Promise<void> {
  await world.pi.beginPrompt(searchPrompt(query))
}

export async function waitForStoredChunks(world: Pick<E2eWorld, "folders">, atLeast: number): Promise<void> {
  while ((await storedChunkCountWhileRunning(world)) < atLeast) await sleep(POLL_INTERVAL_MS)
}
