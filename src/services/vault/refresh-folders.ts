import { basename, dirname, relative, sep } from "node:path"

import { renderFolderIndex } from "#src/domain"
import { catalogStat } from "#src/services/vault/catalog"
import type { NamedVaultContext } from "#src/services/vault/context"
import { linkStatOf, readRawFile, realPathOf, type WriteResult, writeAtomically } from "#src/services/vault/filesystem"
import { FOLDER_INDEX_FILE_NAME } from "./constants.ts"
import { contentsOf } from "./folder-contents.ts"
import { listSettledFolder } from "./list.ts"
import { maintenanceFailure, planRefreshFolders } from "./refresh-plan.ts"
import { refuseWrite } from "./refusals.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type {
  FolderRefreshed,
  FolderRefreshOutcome,
  FolderRefreshResult,
  RefreshContinuation,
  RefreshedFolder,
  RefreshRefusal,
  RefreshResult,
  RefreshScope,
} from "./types.ts"

export async function refreshFolders(
  context: NamedVaultContext,
  folders: string[],
  shouldContinue: RefreshContinuation,
  scope: RefreshScope,
): Promise<FolderRefreshResult> {
  const planned = await planRefreshFolders(context.path, folders, scope)
  if (!planned.succeeded) {
    return { ...planned, refreshed: [] }
  }

  const failures: RefreshRefusal[] = [...planned.output.refusals]
  const maintenanceProblems: string[] = []
  const refreshed: RefreshedFolder[] = []
  const writtenPaths = new Map<string, FolderRefreshed>()
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
      continue
    }

    refreshed.push({ folder, index: written.output.index, settled: written.output.settled })
    if (written.output.maintenanceProblems) {
      maintenanceProblems.push(...written.output.maintenanceProblems)
    }
  }

  return { ...summarize(failures, maintenanceProblems), refreshed }
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
  writtenPaths: Map<string, FolderRefreshed>,
  shouldContinue: RefreshContinuation,
): Promise<FolderRefreshOutcome> {
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
  writtenPaths: Map<string, FolderRefreshed>,
  shouldContinue: RefreshContinuation,
): Promise<FolderRefreshOutcome> {
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
  const alreadyWritten = writtenPaths.get(path.output)
  if (alreadyWritten) {
    return { succeeded: true, output: { index: alreadyWritten.index, settled: alreadyWritten.settled } }
  }

  const root = await resolveFolder(context.path, "")
  if (!root.succeeded) {
    return root
  }

  const physical = relative(root.output, directory.output).split(sep).join("/")
  const listing = await listSettledFolder(context, physical)
  if (!listing.succeeded) {
    return listing
  }

  const contents = await contentsOf(context, physical, listing.output.listing)
  if (!shouldContinue()) {
    return interruption()
  }

  const refreshed = await writeAndStat(path.output, folder, renderFolderIndex(contents), listing.output.settled)
  if (refreshed.succeeded) {
    writtenPaths.set(path.output, refreshed.output)
  }
  return refreshed
}

async function writeAndStat(
  path: string,
  folder: string,
  text: string,
  settled: boolean,
): Promise<FolderRefreshOutcome> {
  const written = await writeChangedIndex(path, text)
  if (!written.succeeded) {
    return refuseWrite(folder, "index", written)
  }

  const index = await linkStatOf(path)
  if (!index.succeeded) {
    return index
  }

  const refreshed: FolderRefreshed = { index: catalogStat(index.output), settled }
  if (written.maintenanceProblems) {
    refreshed.maintenanceProblems = written.maintenanceProblems
  }
  return { succeeded: true, output: refreshed }
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
