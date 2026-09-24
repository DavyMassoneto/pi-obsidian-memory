import { existsSync } from "node:fs"
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

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

export function readPackageVersion(dir: string): string {
  const { version } = readJsonFile(join(dir, "package.json"), PackageManifest).data
  parseVersion(version)
  return version
}

export function setPackageVersion(dir: string, version: string): void {
  parseVersion(version)
  const manifest = readJsonFile(join(dir, "package.json"), PackageManifest)
  const lockPath = join(dir, "package-lock.json")
  const lock = existsSync(lockPath) ? readJsonFile(lockPath, PackageLock) : undefined
  writeJsonFile(manifest, { ...manifest.data, version })
  if (lock === undefined) return
  const { data } = lock
  const rootPackage = { ...data.packages[""], version }
  writeJsonFile(lock, { ...data, version, packages: { ...data.packages, "": rootPackage } })
}
