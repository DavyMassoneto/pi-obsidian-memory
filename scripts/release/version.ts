import { existsSync } from "node:fs"
import { join } from "node:path"
import Type from "typebox"
import { readJsonFile, writeJsonFile } from "./json.ts"

export const BUMPS = ["auto", "patch", "minor", "major"] as const
export type Bump = (typeof BUMPS)[number]

export type Version = readonly [major: number, minor: number, patch: number]

const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

const PackageManifest = Type.Object({ version: Type.String() })

const PackageLock = Type.Object({
  version: Type.String(),
  packages: Type.Object({ "": Type.Object({ version: Type.String() }) }),
})

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
