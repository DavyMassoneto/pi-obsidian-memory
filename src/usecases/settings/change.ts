import {
  canonicalizeRegistration,
  changeSetting,
  ensureVaultAssets,
  inspectVaultFolder,
  type MemoryConfig,
  readConfigSnapshot,
  resolveRegistrationVault,
  type SettingChange,
  targetVault,
  writeConfig,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import { captureRegistrationContext, type RegistrationContext } from "#src/usecases/registration"
import type { SettingsChangeFailure, SettingsChangeRequest, SettingsChangeResult } from "./types.ts"

function refused(problems: string[]): SettingsChangeFailure {
  return { succeeded: false, reason: "refused", problems }
}

function interruption(context: RegistrationContext): SettingsChangeFailure | null {
  if (context.signal.aborted || !context.session.isCurrent(context.stamp)) {
    return { succeeded: false, reason: "cancelled", problems: ["settings cancelled or session authority changed"] }
  }
  return null
}

export async function changeMemorySettings(
  request: SettingsChangeRequest,
  callerContext: RegistrationContext,
): Promise<SettingsChangeResult> {
  const context = captureRegistrationContext(callerContext)
  const captured: SettingsChangeRequest = {
    change: structuredClone(request.change),
    expectedHash: request.expectedHash,
  }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) {
    const stopped = interruption(context)
    if (stopped) return stopped
    return refused(["settings session admission refused"])
  }
  try {
    const stopped = interruption(context)
    if (stopped) return stopped
    return await applyChange(captured, context)
  } finally {
    lease.release()
  }
}

async function currentConfig(
  expectedHash: string,
  context: RegistrationContext,
): Promise<Succeeded<MemoryConfig> | SettingsChangeFailure> {
  const snapshot = await readConfigSnapshot({ path: context.configPath })
  if (!snapshot.succeeded) return refused(snapshot.problems)
  if (snapshot.output.state === "missing") return refused(["memory is not configured"])
  if (snapshot.output.hash !== expectedHash) {
    return { succeeded: false, reason: "conflict", problems: ["the config changed on disk since it was read"] }
  }
  const { lexicalParse } = snapshot.output
  if (!lexicalParse.succeeded) return refused(lexicalParse.problems)
  return lexicalParse
}

async function resolvedVault(
  change: SettingChange,
  context: RegistrationContext,
): Promise<SettingChange | SettingsChangeFailure> {
  if (change.kind !== "projectVault") return change
  const vault = resolveRegistrationVault({ vault: change.vault, workingFolder: context.workingFolder })
  if (!vault.succeeded) return refused(vault.problems)
  const folder = await inspectVaultFolder(vault.output)
  if (!folder.succeeded) return refused(folder.problems)
  if (folder.output === "not-directory") return refused([`${vault.output} is a file, not a folder`])
  return { ...change, vault: vault.output }
}

async function prepareProjectVault(
  change: SettingChange,
  config: MemoryConfig,
  context: RegistrationContext,
): Promise<Succeeded<string[]> | SettingsChangeFailure> {
  if (change.kind !== "projectVault") return { succeeded: true, output: [] }
  const project = config.projects.find((entry) => entry.name === change.name)
  if (!project) return refused([`No project named "${change.name}"`])
  const canonical = await canonicalizeRegistration({
    config,
    configPath: context.configPath,
    indexPath: context.indexPath,
  })
  if (!canonical.succeeded) return refused(canonical.problems)
  const target = targetVault(config, "project", project.folder)
  if (!target.succeeded) return refused(target.problems)
  const assets = await ensureVaultAssets({ ...target.output, limits: config.limits })
  if (!assets.succeeded) return refused(assets.problems)
  return { succeeded: true, output: assets.output.maintenanceProblems }
}

function isFailure(value: SettingChange | SettingsChangeFailure): value is SettingsChangeFailure {
  return "succeeded" in value
}

async function applyChange(
  request: SettingsChangeRequest,
  context: RegistrationContext,
): Promise<SettingsChangeResult> {
  const current = await currentConfig(request.expectedHash, context)
  if (!("output" in current)) return current
  const change = await resolvedVault(request.change, context)
  if (isFailure(change)) return change
  const next = changeSetting(current.output, change)
  if (!next.succeeded) return refused(next.problems)
  const stopped = interruption(context)
  if (stopped) return stopped
  const assets = await prepareProjectVault(change, next.output, context)
  if (!assets.succeeded) return assets
  const written = await writeConfig({
    path: context.configPath,
    indexPath: context.indexPath,
    config: next.output,
    expectedHash: request.expectedHash,
  })
  if (!written.succeeded) {
    if (written.reason === "conflict") return { succeeded: false, reason: "conflict", problems: written.problems }
    return refused(written.problems)
  }
  if (context.session.isCurrent(context.stamp)) context.session.invalidate(context.stamp)
  return {
    succeeded: true,
    output: {
      configHash: written.output.hash,
      config: next.output,
      warnings: [...assets.output, ...written.warnings],
    },
  }
}

export { parseSettingNumber } from "#src/services"
