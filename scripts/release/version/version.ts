import { join } from "node:path"

import { readJsonFile, writeJsonFile } from "../index.ts"
import { BUMPS, RELEASE_VERSION } from "./constants.ts"
import { PackageLock, PackageManifest } from "./schemas.ts"
import type { Bump, Version } from "./types.ts"

export function isBump(value: string): value is Bump {
  return BUMPS.some((bump) => bump === value)
}

export function parseVersion(version: string): Version {
  const match = RELEASE_VERSION.exec(version)
  if (!match) throw new Error(`versão inválida: "${version}" (esperado X.Y.Z)`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const [major, minor, patch] = parseVersion(candidate)
  const [currentMajor, currentMinor, currentPatch] = parseVersion(current)
  if (major !== currentMajor) return major > currentMajor
  if (minor !== currentMinor) return minor > currentMinor
  return patch > currentPatch
}

export function readPackageVersion(dir: string): string {
  const { version } = readJsonFile(join(dir, "package.json"), PackageManifest).data
  parseVersion(version)
  return version
}

export function setPackageVersion(dir: string, version: string): void {
  parseVersion(version)
  const manifest = readJsonFile(join(dir, "package.json"), PackageManifest)
  const lock = readJsonFile(join(dir, "package-lock.json"), PackageLock)
  const rootPackage = { ...lock.data.packages[""], version }
  writeJsonFile(manifest, { ...manifest.data, version })
  writeJsonFile(lock, { ...lock.data, version, packages: { ...lock.data.packages, "": rootPackage } })
}
