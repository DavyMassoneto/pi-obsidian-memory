import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect } from "vitest"

import { localEmbeddingConfiguration, localEmbeddingPolicy } from "#src/domain"
import { memoryModelCachePath } from "#src/pi"
import { inspectModelAsset, localModelAssets } from "#src/services"
import { searchAnswer } from "./e2e-semantic.ts"
import type { E2eWorld } from "./e2e-world.ts"

export const DAMAGED_CONFIG_TEXT = "not the real file"

export function localModelFolder(world: Pick<E2eWorld, "folders">): string {
  return join(
    memoryModelCachePath(world.folders.agentDir),
    localEmbeddingConfiguration.model,
    localEmbeddingPolicy.revision,
  )
}

export async function plantDamagedModel(world: Pick<E2eWorld, "folders">): Promise<string> {
  const folder = localModelFolder(world)
  await mkdir(folder, { recursive: true })
  const configPath = join(folder, "config.json")
  await writeFile(configPath, DAMAGED_CONFIG_TEXT)
  return configPath
}

export async function downloadLocalModel(world: Pick<E2eWorld, "folders" | "pi">): Promise<void> {
  const answer = await searchAnswer(world, "download the local model")
  expect(answer.isError, answer.text).toBe(false)
  await expectEveryAssetDownloaded(world)
}

export async function expectEveryAssetDownloaded(world: Pick<E2eWorld, "folders">): Promise<void> {
  const folder = localModelFolder(world)
  const expected = localModelAssets.map((asset) => join(folder, asset.path).replaceAll("\\", "/")).sort()
  expect(await modelFilesOnDisk(world)).toEqual(expected)
  const signal = new AbortController().signal
  for (const asset of localModelAssets) {
    expect(await inspectModelAsset(join(folder, asset.path), asset, signal), asset.path).toBe("valid")
  }
}

export async function modelFilesOnDisk(world: Pick<E2eWorld, "folders">): Promise<string[]> {
  try {
    const entries = await readdir(memoryModelCachePath(world.folders.agentDir), {
      recursive: true,
      withFileTypes: true,
    })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).replaceAll("\\", "/"))
      .sort()
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
    throw error
  }
}
