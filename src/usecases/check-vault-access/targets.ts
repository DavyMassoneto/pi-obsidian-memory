import {
  absoluteCandidate,
  canonicalizeAccessPath,
  fileIdentity,
  type PathIdentity,
  pathIdentities,
  vaultAccessRefusal,
} from "#src/services"
import { NAMESPACE_PATH_START, NO_FILE_ID } from "./constants.ts"
import type { GuardedTargets, TargetCheck } from "./types.ts"

export async function guardedTargets(written: string[]): Promise<GuardedTargets> {
  const roots = [...written]
  const identities: PathIdentity[] = []
  for (const path of written) {
    const canonical = await canonicalizeAccessPath(path)
    if (canonical.succeeded) roots.push(canonical.output)
    const identity = await fileIdentity(path)
    if (identity.succeeded && hasFileId(identity.output)) identities.push(identity.output)
  }
  return { roots, identities }
}

export async function hitsTargets(check: TargetCheck): Promise<boolean> {
  const { request, cwd, home, targets } = check
  if (vaultAccessRefusal(request, cwd, home, targets.roots)) return true
  if (request.kind === "command") return false
  const absolute = absoluteCandidate(request.path, cwd, home)
  const canonical = await canonicalizeAccessPath(absolute)
  if (
    canonical.succeeded &&
    vaultAccessRefusal({ kind: request.kind, path: canonical.output }, cwd, home, targets.roots)
  ) {
    return true
  }
  return sharesIdentity(absolute, targets.identities)
}

async function sharesIdentity(absolute: string, identities: PathIdentity[]): Promise<boolean> {
  const found = await pathIdentities(absolute)
  if (!found.succeeded) return NAMESPACE_PATH_START.test(absolute)
  return found.output
    .filter(hasFileId)
    .some((seen) => identities.some((target) => target.device === seen.device && target.inode === seen.inode))
}

function hasFileId(identity: PathIdentity): boolean {
  return identity.inode !== NO_FILE_ID
}
