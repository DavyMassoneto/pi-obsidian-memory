import {
  type ConfigRefusal,
  canonicalizeRegistration,
  canonicalizeWorkingFolder,
  type MemoryConfig,
  type MemoryScope,
  readConfigSnapshot,
  targetVault,
} from "#src/services"
import {
  type MemoryOperationContext,
  memoryOperationInterruption,
  staleMemorySession,
} from "#src/usecases/operation-context"
import type { ResolvedMemory, ResolveMemoryResult, SelectMemoryVaultResult } from "./types.ts"

export async function resolveLeasedMemory(context: MemoryOperationContext): Promise<ResolveMemoryResult> {
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  const snapshot = await readConfigSnapshot({ path: context.configPath })
  const stale = memoryOperationInterruption(context)
  if (stale) return stale
  if (!snapshot.succeeded) {
    context.session.invalidate(context.stamp)
    return { ...snapshot, reason: "config-unavailable", configPath: context.configPath }
  }
  if (snapshot.output.state === "missing") {
    context.session.invalidate(context.stamp)
    return {
      succeeded: false,
      reason: "not-configured",
      configPath: context.configPath,
      problems: ["Memory is not configured; provide a complete config file"],
    }
  }
  if (!context.session.acceptConfiguration(context.stamp, snapshot.output.hash)) return staleMemorySession()
  const parsed = snapshot.output.lexicalParse
  if (!parsed.succeeded) return invalidMemoryConfiguration(context, parsed.problems)
  return validateMemoryLocations(context, parsed.output, snapshot.output.hash)
}

async function validateMemoryLocations(
  context: MemoryOperationContext,
  config: MemoryConfig,
  hash: string,
): Promise<ResolveMemoryResult> {
  const canonical = await canonicalizeRegistration({
    config,
    configPath: context.configPath,
    indexPath: context.indexPath,
  })
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!canonical.succeeded) return invalidMemoryConfiguration(context, canonical.problems)
  const workingFolder = await canonicalizeWorkingFolder(context.workingFolder)
  const stale = memoryOperationInterruption(context)
  if (stale) return stale
  if (!workingFolder.succeeded) return invalidMemoryConfiguration(context, workingFolder.problems)
  return resolvedMemory(canonical.output.config, hash, workingFolder.output, canonical.output.indexPath)
}

function resolvedMemory(
  config: MemoryConfig,
  configHash: string,
  workingFolder: string,
  indexPath: string,
): ResolveMemoryResult {
  const global = targetVault(config, "global", workingFolder)
  if (!global.succeeded) throw new Error("Global target requires no project selection")
  const projectTarget = targetVault(config, "project", workingFolder)
  const output: ResolvedMemory = {
    config,
    configHash,
    workingFolder,
    indexPath,
    global: { scope: "global", vault: { ...global.output, limits: { ...config.limits } } },
    project: null,
    protectedRoots: [config.global.vault, ...config.projects.map((project) => project.vault)],
  }
  if (projectTarget.succeeded) {
    output.project = { scope: "project", vault: { ...projectTarget.output, limits: { ...config.limits } } }
  }
  return { succeeded: true, output }
}

function invalidMemoryConfiguration(context: MemoryOperationContext, problems: string[]): ConfigRefusal {
  return { succeeded: false, reason: "invalid-config", configPath: context.configPath, problems }
}

export function selectMemoryVault(memory: ResolvedMemory, scope: MemoryScope): SelectMemoryVaultResult {
  if (scope === "global") return { succeeded: true, output: memory.global }
  if (memory.project) return { succeeded: true, output: memory.project }
  return {
    succeeded: false,
    reason: "no-project",
    workingFolder: memory.workingFolder,
    problems: ["The current folder has no registered project; use global memory instead"],
  }
}
