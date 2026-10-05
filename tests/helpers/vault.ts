import { existsSync } from "node:fs"
import { mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, parse } from "node:path"

import { onTestFinished } from "vitest"

export async function useTempVault(): Promise<string> {
  const vault = await mkdtemp(join(tmpdir(), "vault-"))
  onTestFinished(() => rm(vault, { recursive: true, force: true }))
  return vault
}

export async function linkFolder(target: string, link: string): Promise<void> {
  await symlink(target, link, "junction")
}

export async function tryLinkFile(target: string, link: string): Promise<boolean> {
  try {
    await symlink(target, link, "file")
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      return false
    }

    throw error
  }
}

export function otherDriveRoots(): string[] {
  const tempDrive = parse(tmpdir()).root.toUpperCase()
  const letters = [..."CDEFGHIJKLMNOPQRSTUVWXYZ"]

  return letters.map((letter) => `${letter}:\\`).filter((root) => root !== tempDrive && existsSync(root))
}
