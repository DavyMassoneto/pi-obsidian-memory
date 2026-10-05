import { isAbsolute, join, relative, sep } from "node:path"

import { checkFileName, checkVaultPath, joinVaultPath, VAULT_PATH_SEPARATOR } from "#/domain"
import { linkStatOf, linkTargetOf, realPathOf } from "./files.ts"
import type { CheckResult, ResolveResult, VaultRefusal } from "./types.ts"

export async function resolveFolder(vault: string, folder: string): Promise<ResolveResult> {
  return resolveParts(vault, checkVaultPath(folder), partsOf(folder))
}

export async function resolveFile(vault: string, folder: string, fileName: string): Promise<ResolveResult> {
  const problems = [...checkVaultPath(folder), ...checkFileName(fileName)]
  return resolveParts(vault, problems, [...partsOf(folder), fileName])
}

async function resolveParts(vault: string, problems: string[], parts: string[]): Promise<ResolveResult> {
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const inside = await checkLinksStayInside(vault, parts)
  if (!inside.succeeded) {
    return inside
  }

  return { succeeded: true, output: join(vault, ...parts) }
}

async function checkLinksStayInside(vault: string, parts: string[]): Promise<CheckResult> {
  const realVault = await realPathOf(vault)
  if (!realVault.succeeded) {
    return { succeeded: false, reason: "vault-missing", problems: [`the vault folder ${vault} does not exist`] }
  }

  for (const depth of parts.keys()) {
    const walked = parts.slice(0, depth + 1)
    const path = join(vault, ...walked)

    const stat = await linkStatOf(path)
    if (!stat.succeeded) {
      return { succeeded: true }
    }

    if (stat.output.isSymbolicLink()) {
      const inside = await checkLinkTarget(realVault.output, path, joinVaultPath(...walked))
      if (!inside.succeeded) {
        return inside
      }
    }
  }

  return { succeeded: true }
}

async function checkLinkTarget(realVault: string, path: string, displayPath: string): Promise<CheckResult> {
  const target = await linkTargetOf(path)
  if (!target.succeeded) {
    return { succeeded: false, reason: "outside-vault", problems: [`${displayPath} is a link that does not resolve`] }
  }

  if (!isInside(realVault, target.output)) {
    return refuseOutside(displayPath)
  }

  return { succeeded: true }
}

function isInside(root: string, path: string): boolean {
  const fromRoot = relative(root, path)
  return !isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`)
}

function refuseOutside(displayPath: string): VaultRefusal {
  return { succeeded: false, reason: "outside-vault", problems: [`${displayPath} leads outside the vault`] }
}

function partsOf(folder: string): string[] {
  return folder.split(VAULT_PATH_SEPARATOR).filter((part) => part.length > 0)
}
