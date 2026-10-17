import { readConfigSnapshot } from "#src/services"
import type { RegistrationContext } from "#src/usecases/registration"
import { captureRegistrationContext } from "#src/usecases/registration"
import type { SettingsPreparationResult } from "./types.ts"

export async function prepareMemorySettings(callerContext: RegistrationContext): Promise<SettingsPreparationResult> {
  const context = captureRegistrationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return { succeeded: false, reason: "unreadable", problems: ["settings session admission refused"] }
  try {
    const snapshot = await readConfigSnapshot({ path: context.configPath })
    if (!snapshot.succeeded) return { succeeded: false, reason: "unreadable", problems: snapshot.problems }
    if (snapshot.output.state === "missing") {
      return { succeeded: false, reason: "not-configured", problems: ["memory is not configured"] }
    }
    const { lexicalParse, hash } = snapshot.output
    if (!lexicalParse.succeeded) {
      return { succeeded: false, reason: "invalid-config", problems: lexicalParse.problems }
    }
    return { succeeded: true, output: { config: lexicalParse.output, hash } }
  } finally {
    lease.release()
  }
}
