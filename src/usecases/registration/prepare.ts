import { prepareSetupDefaults, readConfigSnapshot } from "#src/services"
import { captureRegistrationContext, captureSelectedModel } from "./entry.ts"
import { registrationInterruption } from "./publication.ts"
import type { RegistrationContext, SetupPreparationRequest, SetupPreparationResult } from "./types.ts"

export async function prepareMemorySetup(
  input: SetupPreparationRequest,
  callerContext: RegistrationContext,
): Promise<SetupPreparationResult> {
  const context = captureRegistrationContext(callerContext)
  const selectedModel = captureSelectedModel(input.selectedModel)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return { succeeded: false, problems: ["registration session admission refused"] }
  try {
    const interrupted = registrationInterruption(context)
    if (interrupted) return interrupted
    const snapshot = await readConfigSnapshot({ path: context.configPath })
    const stale = registrationInterruption(context)
    if (stale) return stale
    if (!snapshot.succeeded) return snapshot
    const defaults = prepareSetupDefaults(selectedModel)
    let draft = defaults
    if (snapshot.output.state === "present") {
      const repair = snapshot.output.repair
      draft = {
        ...repair,
        capture: { ...repair.capture, model: { ...defaults.capture.model, ...repair.capture.model } },
        memoryAgent: { model: { ...defaults.memoryAgent.model, ...repair.memoryAgent.model } },
      }
    }
    return { succeeded: true, output: { snapshot: snapshot.output, draft, selectedModel } }
  } finally {
    lease.release()
  }
}
