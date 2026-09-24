import { join } from "node:path"

import { parseValue, readJsonFile, writeJsonFile } from "../index.ts"
import { RELEASE_VERSION } from "./constants.ts"
import { PackageLock, PackageManifest, VersionPartsSchema } from "./schemas.ts"
import type { Version } from "./types.ts"

export function parseVersion(version: string): Version {
  const match = RELEASE_VERSION.exec(version)
  if (!match) throw new Error(`versão inválida: "${version}" (esperado X.Y.Z)`)
  const parts = parseValue(VersionPartsSchema, match.groups, `versão ${version}`)
  return { major: Number(parts.major), minor: Number(parts.minor), patch: Number(parts.patch) }
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate)
  const now = parseVersion(current)
  if (next.major !== now.major) return next.major > now.major
  if (next.minor !== now.minor) return next.minor > now.minor
  return next.patch > now.patch
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
