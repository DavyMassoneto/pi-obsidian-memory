import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { localEmbeddingConfiguration, localEmbeddingPolicy } from "#src/domain"
import { DOCTOR_TITLE, memoryModelCachePath } from "#src/pi"
import type { MemoryConfig } from "#src/services"
import { configuredWorld, onlyNotice, rewriteConfig } from "./e2e-config.ts"
import { runDoctor } from "./e2e-doctor-steps.ts"
import { E2E_MODEL, E2E_PROVIDER } from "./e2e-paths.ts"
import type { Notify } from "./e2e-records.ts"
import { writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const BLANK_PATH = "tools/Blank.md"
export const BLANK_LABEL = `global/${BLANK_PATH}`
export const CAPTURE_OK = `- capture ${E2E_PROVIDER}/${E2E_MODEL}: ok`
export const DECISION_CUTOFFS = { gateThreshold: 0.2, relevanceThreshold: 0.5 }

export async function worldWithBlank(text: string): Promise<E2eWorld> {
  const world = await configuredWorld({ capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, BLANK_PATH, text)
  await writeVaultFile(world.folders.globalVault, "tools/Other.md", noteWithId(2, "Other.", []))
  return world
}

export function blankFile(world: E2eWorld): Promise<string> {
  return readFile(join(world.folders.globalVault, BLANK_PATH), "utf8")
}

export async function worldOnLaya(decisionModel: MemoryConfig["decisionModel"]): Promise<E2eWorld> {
  const world = await configuredWorld({ capture: "at-session-end" })
  await rewriteConfig(world, { decisionModel })
  await world.restart()
  return world
}

export async function worldOnEmbeddings(embeddings: MemoryConfig["embeddings"]): Promise<E2eWorld> {
  const world = await configuredWorld({ capture: "at-session-end" })
  await rewriteConfig(world, { embeddings })
  return world
}

export async function damageLocalModel(world: E2eWorld): Promise<void> {
  const directory = join(
    memoryModelCachePath(world.folders.agentDir),
    localEmbeddingConfiguration.model,
    localEmbeddingPolicy.revision,
  )
  await writeFile(join(directory, "config.json"), "not the real file")
}

export async function doctorReport(world: Pick<E2eWorld, "pi">): Promise<Notify> {
  const turn = await runDoctor(world, [], 0)
  return onlyNotice({
    ...turn,
    notifications: turn.notifications.filter((notice) => notice.message.startsWith(DOCTOR_TITLE)),
  })
}
