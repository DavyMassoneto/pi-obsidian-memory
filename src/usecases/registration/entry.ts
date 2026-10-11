import type { ChatModelReference, RegistrationContext, SetupCommitCaptureResult, SetupCommitRequest } from "./types.ts"

export function captureRegistrationContext(context: RegistrationContext): RegistrationContext {
  return {
    configPath: context.configPath,
    workingFolder: context.workingFolder,
    indexPath: context.indexPath,
    session: context.session,
    stamp: context.stamp,
    signal: context.signal,
  }
}

export function captureSelectedModel(model: ChatModelReference | null): ChatModelReference | null {
  if (!model) return null
  return { ...model }
}

export function captureSetupCommit(request: SetupCommitRequest): SetupCommitCaptureResult {
  try {
    return {
      succeeded: true,
      output: {
        config: structuredClone(request.config),
        expectedHash: request.expectedHash,
        replacementConfirmed: request.replacementConfirmed,
        disclosuresConfirmed: request.disclosuresConfirmed,
      },
    }
  } catch (error) {
    return { succeeded: false, problems: [`setup config could not be captured: ${String(error)}`] }
  }
}
