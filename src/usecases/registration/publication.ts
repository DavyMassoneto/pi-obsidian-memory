import {
  canonicalizeRegistration,
  checkConfigSnapshot,
  ensureVaultAssets,
  targetVault,
  type VaultBootstrapProgress,
  writeConfig,
} from "#src/services"
import type { Failed } from "#src/shared"
import type {
  RegistrationCause,
  RegistrationContext,
  RegistrationFailure,
  RegistrationPublication,
  RegistrationResult,
  RegistrationStage,
} from "./types.ts"

export function registrationInterruption(context: RegistrationContext): Failed | null {
  if (context.signal.aborted || !context.session.isCurrent(context.stamp)) {
    return { succeeded: false, problems: ["registration cancelled or session authority changed"] }
  }
  return null
}

export function registrationFailure(
  stage: RegistrationStage,
  cause: RegistrationCause,
  assets: VaultBootstrapProgress,
): RegistrationFailure {
  return { succeeded: false, stage, cause, assets, problems: cause.problems }
}

export function registrationValidationFailure(cause: RegistrationCause): RegistrationFailure {
  return registrationFailure("validation", cause, {
    createdRoot: false,
    created: [],
    preserved: [],
    maintenanceProblems: [],
  })
}

export async function publishRegistration(
  publication: RegistrationPublication,
  context: RegistrationContext,
): Promise<RegistrationResult> {
  const { write, scope } = publication
  const canonical = await canonicalizeRegistration({
    config: write.config,
    configPath: write.path,
    indexPath: write.indexPath,
  })
  const interrupted = registrationInterruption(context)
  if (interrupted) return registrationValidationFailure(interrupted)
  if (!canonical.succeeded) return registrationValidationFailure(canonical)
  const snapshot = await checkConfigSnapshot(write)
  const stale = registrationInterruption(context)
  if (stale) return registrationValidationFailure(stale)
  if (!snapshot.succeeded) return registrationValidationFailure(snapshot)
  const target = targetVault(write.config, scope, context.workingFolder)
  if (!target.succeeded) return registrationValidationFailure(target)
  const assets = await ensureVaultAssets({ ...target.output, limits: write.config.limits })
  if (!assets.succeeded) return registrationFailure("bootstrap", assets, assets)
  return commitRegistration(publication, context, assets.output)
}

async function commitRegistration(
  publication: RegistrationPublication,
  context: RegistrationContext,
  assets: VaultBootstrapProgress,
): Promise<RegistrationResult> {
  const interrupted = registrationInterruption(context)
  if (interrupted) return registrationFailure("config", interrupted, assets)
  const snapshot = await checkConfigSnapshot(publication.write)
  const stale = registrationInterruption(context)
  if (stale) return registrationFailure("config", stale, assets)
  if (!snapshot.succeeded) return registrationFailure("config", snapshot, assets)
  const written = await writeConfig(publication.write)
  if (!written.succeeded) return registrationFailure("config", written, assets)
  if (context.session.isCurrent(context.stamp)) context.session.invalidate(context.stamp)
  return {
    succeeded: true,
    output: {
      configHash: written.output.hash,
      assets,
      warnings: [...assets.maintenanceProblems, ...written.warnings],
    },
  }
}
