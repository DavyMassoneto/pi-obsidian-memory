import {
  canonicalizeRegistration,
  type MemoryConfig,
  proposeInit,
  readConfigSnapshot,
  resolveRegistrationVault,
} from "#src/services"
import { captureRegistrationContext } from "./entry.ts"
import { publishRegistration, registrationInterruption, registrationValidationFailure } from "./publication.ts"
import type { InitCommitRequest, RegistrationContext, RegistrationResult } from "./types.ts"

export async function initProjectMemory(
  input: InitCommitRequest,
  callerContext: RegistrationContext,
): Promise<RegistrationResult> {
  const context = captureRegistrationContext(callerContext)
  const request = { name: input.name, vault: input.vault, expectedHash: input.expectedHash }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) {
    return registrationValidationFailure({ succeeded: false, problems: ["registration session admission refused"] })
  }
  try {
    const interrupted = registrationInterruption(context)
    if (interrupted) return registrationValidationFailure(interrupted)
    return await prepareProjectRegistration(request, context)
  } finally {
    lease.release()
  }
}

async function prepareProjectRegistration(
  request: InitCommitRequest,
  context: RegistrationContext,
): Promise<RegistrationResult> {
  const snapshot = await readConfigSnapshot({ path: context.configPath })
  const interrupted = registrationInterruption(context)
  if (interrupted) return registrationValidationFailure(interrupted)
  if (!snapshot.succeeded) return registrationValidationFailure(snapshot)
  if (snapshot.output.state === "missing") {
    return registrationValidationFailure({
      succeeded: false,
      reason: "not-configured",
      configPath: context.configPath,
      problems: ["project registration requires a configured global vault"],
    })
  }
  if (snapshot.output.hash !== request.expectedHash) {
    return registrationValidationFailure({
      succeeded: false,
      reason: "conflict",
      problems: ["config changed since it was read"],
      warnings: [],
    })
  }
  const parsed = snapshot.output.lexicalParse
  if (!parsed.succeeded) return registrationValidationFailure(parsed)
  return proposeProjectRegistration(request, context, parsed.output)
}

async function proposeProjectRegistration(
  request: InitCommitRequest,
  context: RegistrationContext,
  config: MemoryConfig,
): Promise<RegistrationResult> {
  const valid = await canonicalizeRegistration({ config, configPath: context.configPath, indexPath: context.indexPath })
  const stale = registrationInterruption(context)
  if (stale) return registrationValidationFailure(stale)
  if (!valid.succeeded) return registrationValidationFailure(valid)
  const vault = resolveRegistrationVault({ vault: request.vault, workingFolder: context.workingFolder })
  if (!vault.succeeded) return registrationValidationFailure(vault)
  const proposal = proposeInit({ config, folder: context.workingFolder, name: request.name, vault: vault.output })
  if (!proposal.succeeded) return registrationValidationFailure(proposal)
  return publishRegistration(
    {
      scope: "project",
      write: {
        path: context.configPath,
        indexPath: context.indexPath,
        config: proposal.output,
        expectedHash: request.expectedHash,
      },
    },
    context,
  )
}
