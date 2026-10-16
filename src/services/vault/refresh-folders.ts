import { basename, dirname, relative, sep } from "node:path"

import { renderFolderIndex } from "#src/domain"
import type { NamedVaultContext } from "#src/services/vault/context"
import { readRawFile, realPathOf, type WriteResult, writeAtomically } from "#src/services/vault/filesystem"
import { FOLDER_INDEX_FILE_NAME } from "./constants.ts"
import { contentsOf } from "./folder-contents.ts"
import { listFolder } from "./list.ts"
import { maintenanceFailure, planRefreshFolders } from "./refresh-plan.ts"
import { refuseWrite } from "./refusals.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { RefreshContinuation, RefreshRefusal, RefreshResult } from "./types.ts"

export async function refreshFolders(
  context: NamedVaultContext,
  folders: string[],
  shouldContinue: RefreshContinuation,
): Promise<RefreshResult> {
  const planned = await planRefreshFolders(context.path, folders)
  if (!planned.succeeded) {
    return planned
  }

  const failures: RefreshRefusal[] = [...planned.output.refusals]
  const maintenanceProblems: string[] = []
  const writtenPaths = new Set<string>()
  for (const folder of planned.output.folders) {
    if (!shouldContinue()) {
      failures.unshift(interruption())
      break
    }

    const written = await refreshFolder(context, folder, writtenPaths, shouldContinue)
    if (!written.succeeded && written.reason === "interrupted") {
      failures.unshift(written)
      break
    }
    if (!written.succeeded) {
      failures.push(written)
    } else if (written.maintenanceProblems) {
      maintenanceProblems.push(...written.maintenanceProblems)
    }
  }

  return summarize(failures, maintenanceProblems)
}

function interruption(): RefreshRefusal {
  return {
    succeeded: false,
    reason: "interrupted",
    problems: ["Folder index maintenance stopped before every index was refreshed"],
  }
}

export function alwaysContinue(): boolean {
  return true
}

function summarize(failures: RefreshRefusal[], maintenanceProblems: string[]): RefreshResult {
  const [first] = failures
  if (first) {
    return {
      succeeded: false,
      reason: first.reason,
      problems: [...new Set([...failures.flatMap((failure) => failure.problems), ...maintenanceProblems])],
    }
  }
  if (maintenanceProblems.length > 0) {
    return { succeeded: true, maintenanceProblems }
  }
  return { succeeded: true }
}

async function refreshFolder(
  context: NamedVaultContext,
  folder: string,
  writtenPaths: Set<string>,
  shouldContinue: RefreshContinuation,
): Promise<RefreshResult> {
  try {
    return await writeIndex(context, folder, writtenPaths, shouldContinue)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return maintenanceFailure(error)
  }
}

async function writeIndex(
  context: NamedVaultContext,
  folder: string,
  writtenPaths: Set<string>,
  shouldContinue: RefreshContinuation,
): Promise<RefreshResult> {
  const directory = await resolveFolder(context.path, folder)
  if (!directory.succeeded) {
    return directory
  }

  const path = await resolveFile(context.path, folder, FOLDER_INDEX_FILE_NAME)
  if (!path.succeeded) {
    return path
  }
  if (!(await isOwnIndex(directory.output, path.output))) {
    return {
      succeeded: false,
      reason: "invalid",
      problems: [`Folder index of "${folder}" must be the index.md of its own folder`],
    }
  }
  if (writtenPaths.has(path.output)) {
    return { succeeded: true }
  }

  const root = await resolveFolder(context.path, "")
  if (!root.succeeded) {
    return root
  }

  const physical = relative(root.output, directory.output).split(sep).join("/")
  const listing = await listFolder(context, physical)
  if (!listing.succeeded) {
    return listing
  }

  const contents = await contentsOf(context, physical, listing.output)
  if (!shouldContinue()) {
    return interruption()
  }

  const written = await writeChangedIndex(path.output, renderFolderIndex(contents))
  if (!written.succeeded) {
    return refuseWrite(folder, "index", written)
  }

  writtenPaths.add(path.output)
  return written
}

async function isOwnIndex(directory: string, target: string): Promise<boolean> {
  if (basename(target).toLowerCase() !== FOLDER_INDEX_FILE_NAME) {
    return false
  }
  if (dirname(target) === directory) {
    return true
  }

  const [home, targetHome] = await Promise.all([realPathOf(directory), realPathOf(dirname(target))])
  return home.succeeded && targetHome.succeeded && home.output === targetHome.output
}

async function writeChangedIndex(path: string, text: string): Promise<WriteResult> {
  const existing = await readRawFile(path)
  if (existing.succeeded && existing.output.equals(Buffer.from(text))) return { succeeded: true }
  return writeAtomically(path, text)
}
