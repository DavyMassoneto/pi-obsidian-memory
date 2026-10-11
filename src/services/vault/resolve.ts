import { isAbsolute, join, relative, sep } from "node:path"

import { checkFileName, checkVaultPath, joinVaultPath, VAULT_PATH_SEPARATOR } from "#/domain"
import { linkStatOf, realPathOf } from "#/services/vault/filesystem"
import type { ResolveResult } from "./types.ts"

export async function resolveFolder(vault: string, folder: string): Promise<ResolveResult> {
  return resolveParts(vault, checkVaultPath(folder), partsOf(folder), "directory")
}

export async function resolveFile(vault: string, folder: string, fileName: string): Promise<ResolveResult> {
  const problems = [...checkVaultPath(folder), ...checkFileName(fileName)]
  return resolveParts(vault, problems, [...partsOf(folder), fileName], "file")
}

async function resolveParts(
  vault: string,
  problems: string[],
  parts: string[],
  kind: "directory" | "file",
): Promise<ResolveResult> {
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const root = await resolveRoot(vault)
  if (!root.succeeded) {
    return root
  }

  let current = root.output
  for (const [depth, part] of parts.entries()) {
    const path = join(current, part)
    const target = await resolveEntry(root.output, path, joinVaultPath(...parts.slice(0, depth + 1)))
    if (!target.succeeded) {
      return target
    }

    const stat = await linkStatOf(target.output)
    if (!stat.succeeded) {
      if (stat.reason === "not-found") {
        return { succeeded: true, output: join(target.output, ...parts.slice(depth + 1)) }
      }
      return stat
    }
    if ((depth < parts.length - 1 || kind === "directory") && !stat.output.isDirectory()) {
      return { succeeded: false, reason: "not-directory", problems: [`${path} is not a directory`] }
    }

    current = target.output
  }
  return { succeeded: true, output: current }
}

async function resolveRoot(vault: string): Promise<ResolveResult> {
  const root = await realPathOf(vault)
  if (!root.succeeded) {
    if (root.reason === "not-found") {
      return { succeeded: false, reason: "vault-missing", problems: [`the vault folder ${vault} does not exist`] }
    }
    return root
  }

  const stat = await linkStatOf(root.output)
  if (!stat.succeeded) {
    if (stat.reason === "not-found") {
      return { succeeded: false, reason: "vault-missing", problems: stat.problems }
    }
    return stat
  }
  if (!stat.output.isDirectory()) {
    return { succeeded: false, reason: "not-directory", problems: [`the vault ${vault} is not a directory`] }
  }
  return root
}

async function resolveEntry(root: string, path: string, displayPath: string): Promise<ResolveResult> {
  const stat = await linkStatOf(path)
  if (!stat.succeeded) {
    if (stat.reason === "not-found") {
      return { succeeded: true, output: path }
    }
    return stat
  }
  if (!stat.output.isSymbolicLink()) {
    return { succeeded: true, output: path }
  }

  const target = await realPathOf(path)
  if (!target.succeeded) {
    if (target.reason === "not-found" || target.code === "ELOOP") {
      return { succeeded: false, reason: "outside-vault", problems: [`${displayPath} is a link that does not resolve`] }
    }
    return target
  }
  if (!isInside(root, target.output)) {
    return { succeeded: false, reason: "outside-vault", problems: [`${displayPath} leads outside the vault`] }
  }
  return target
}

function isInside(root: string, path: string): boolean {
  const fromRoot = relative(root, path)
  return !isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`)
}

function partsOf(folder: string): string[] {
  return folder.split(VAULT_PATH_SEPARATOR).filter((part) => part.length > 0)
}
