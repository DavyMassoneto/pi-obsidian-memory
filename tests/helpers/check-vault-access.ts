import { execFileSync } from "node:child_process"
import { homedir, hostname } from "node:os"
import { dirname, parse } from "node:path"

import { checkVaultAccess, type GuardedTargets, hitsTargets, type VaultAccessRequest } from "#src/usecases"
import { searchFixture } from "./search-memory.ts"

const SEPARATOR = "\\"

export async function guardFixture() {
  const fixture = await searchFixture()
  const { configPath } = fixture.context
  const dataFolder = dirname(configPath)
  const cwd = fixture.context.workingFolder
  const check = (request: VaultAccessRequest) => checkVaultAccess({ configPath, cwd, home: homedir(), request })
  return { ...fixture, check, cwd, configPath, dataFolder }
}

export function adminShareForm(path: string): string {
  const { root } = parse(path)
  const drive = root.slice(0, 1)
  const rest = path.slice(root.length)
  return [`${SEPARATOR}${SEPARATOR}${hostname()}`, `${drive}$`, rest].join(SEPARATOR)
}

export function devicePathForm(path: string): string {
  return `${SEPARATOR}${SEPARATOR}.${SEPARATOR}${path}`
}

export function volumeGuidForm(path: string): string {
  const { root } = parse(path)
  const listed = execFileSync("cmd", ["/c", "mountvol", root, "/L"], { encoding: "utf8" }).trim()
  return `${listed}${path.slice(root.length)}`
}

export async function targetHits(targets: GuardedTargets, cwd: string, request: VaultAccessRequest): Promise<boolean> {
  return hitsTargets({ request, cwd, home: homedir(), targets })
}
