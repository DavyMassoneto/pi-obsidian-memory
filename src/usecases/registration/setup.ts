import { resolveRegistrationVault, type WriteConfigRequest } from "#src/services"
import { captureRegistrationContext, captureSetupCommit } from "./entry.ts"
import { publishRegistration, registrationInterruption, registrationValidationFailure } from "./publication.ts"
import type { RegistrationContext, RegistrationResult, SetupCommitRequest } from "./types.ts"

export async function setupMemory(
  input: SetupCommitRequest,
  callerContext: RegistrationContext,
): Promise<RegistrationResult> {
  const context = captureRegistrationContext(callerContext)
  const captured = captureSetupCommit(input)
  if (!captured.succeeded) return registrationValidationFailure(captured)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) {
    return registrationValidationFailure({ succeeded: false, problems: ["registration session admission refused"] })
  }
  try {
    const interrupted = registrationInterruption(context)
    if (interrupted) return registrationValidationFailure(interrupted)
    return await prepareGlobalRegistration(captured.output, context)
  } finally {
    lease.release()
  }
}

async function prepareGlobalRegistration(
  request: SetupCommitRequest,
  context: RegistrationContext,
): Promise<RegistrationResult> {
  if (!request.disclosuresConfirmed) {
    return registrationValidationFailure({ succeeded: false, problems: ["setup disclosures require confirmation"] })
  }
  const vault = resolveRegistrationVault({ vault: request.config.global.vault, workingFolder: context.workingFolder })
  if (!vault.succeeded) return registrationValidationFailure(vault)
  const write: WriteConfigRequest = {
    path: context.configPath,
    indexPath: context.indexPath,
    config: { ...request.config, global: { ...request.config.global, vault: vault.output } },
    expectedHash: request.expectedHash,
  }
  if (request.replacementConfirmed) write.replacementConfirmed = true
  return publishRegistration({ write, scope: "global" }, context)
}
