import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

import { unzipSync } from "fflate"
import { expect } from "vitest"

import { EXPORT_CANCELLED, EXPORT_DONE, EXPORT_FOLDER_TITLE, EXPORT_NAME_TITLE } from "#src/pi"
import { configuredWorld } from "./e2e-config.ts"
import type { UiStep } from "./e2e-protocol.ts"
import { notifySettles } from "./e2e-records.ts"
import { writeVaultFile } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"
import { noteWithId } from "./search-memory.ts"

export const DEFAULT_EXPORT_NAME = /^memory-export-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/
const GLOBAL_NOTE = noteWithId(1, "Always pnpm.", [])
const PROJECT_NOTE = noteWithId(2, "Jenkins builds main.", [])
export const EXPORT_SETTLES = notifySettles([EXPORT_DONE, EXPORT_CANCELLED])

export function exportFolderStep(answer: UiStep["answer"]): UiStep {
  return { method: "input", title: EXPORT_FOLDER_TITLE, answer }
}

export function exportNameStep(answer: UiStep["answer"]): UiStep {
  return { method: "input", title: EXPORT_NAME_TITLE, answer }
}

export async function exportableWorld(): Promise<E2eWorld> {
  const world = await configuredWorld({})
  await writeVaultFile(world.folders.globalVault, "tools/Use pnpm.md", GLOBAL_NOTE)
  await writeVaultFile(world.folders.projectVault, "ci/CI runs on Jenkins.md", PROJECT_NOTE)
  return world
}

export async function expectZipHoldsBothVaults(world: E2eWorld, zipPath: string): Promise<number> {
  const entries = new Map(Object.entries(unzipSync(await readFile(zipPath))))
  const files = [
    ...(await vaultFiles(world.folders.globalVault, "global")),
    ...(await vaultFiles(world.folders.projectVault, "project")),
  ]
  expect([...entries.keys()].sort()).toEqual(files.map((file) => file.entry).sort())
  const pnpmNote = entries.get("global/tools/Use pnpm.md")
  if (!pnpmNote) throw new Error("global/tools/Use pnpm.md is not in the zip")
  expect(Buffer.from(pnpmNote).toString("utf8")).toBe(GLOBAL_NOTE)
  for (const file of files) {
    const zipped = entries.get(file.entry)
    if (!zipped) throw new Error(`${file.entry} is not in the zip`)
    expect(Buffer.from(zipped).equals(file.bytes)).toBe(true)
  }
  return files.length
}

interface VaultFile {
  entry: string
  bytes: Buffer
}

async function vaultFiles(vault: string, prefix: string): Promise<VaultFile[]> {
  const listed = await readdir(vault, { recursive: true, withFileTypes: true })
  const files = listed.filter((item) => item.isFile())
  return Promise.all(
    files.map(async (file) => {
      const path = join(file.parentPath, file.name)
      const relativePath = relative(vault, path).replaceAll("\\", "/")
      return { entry: `${prefix}/${relativePath}`, bytes: await readFile(path) }
    }),
  )
}
