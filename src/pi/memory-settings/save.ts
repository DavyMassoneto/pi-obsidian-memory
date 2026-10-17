import { changeMemorySettings } from "#src/usecases"
import { RELOAD_NOTE, SAVED } from "./constants.ts"
import type { Saving, SettingsEnv } from "./types.ts"

export async function saveChange(env: SettingsEnv, saving: Saving): Promise<boolean> {
  const result = await changeMemorySettings({ change: saving.change, expectedHash: env.state.hash }, env.context)
  if (!result.succeeded) {
    if (result.reason !== "cancelled") env.ctx.ui.notify(result.problems.join("\n"), "error")
    return false
  }
  const lines = [`${SAVED} ${saving.what}.`]
  if (saving.reload) lines.push(RELOAD_NOTE)
  lines.push(...result.output.warnings.map((warning) => `- ${warning}`))
  env.ctx.ui.notify(lines.join("\n"), "info")
  return true
}
