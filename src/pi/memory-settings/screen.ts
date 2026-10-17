import type { MemoryPiContext } from "#src/pi/context"
import { prepareMemorySettings, type RegistrationContext } from "#src/usecases"
import { DONE_LABEL, SETTINGS_TITLE } from "./constants.ts"
import { settingLines } from "./lines.ts"
import type { SettingsDeps } from "./types.ts"

function freshContext(base: RegistrationContext): RegistrationContext {
  const stamp = base.session.stamp()
  return { ...base, stamp, signal: base.session.signal(stamp) }
}

export async function runSettingsScreen(ctx: MemoryPiContext, deps: SettingsDeps): Promise<void> {
  while (true) {
    const context = freshContext(deps.registration)
    const prepared = await prepareMemorySettings(context)
    if (!prepared.succeeded) {
      if (!context.signal.aborted) ctx.ui.notify(prepared.problems.join("\n"), "error")
      return
    }
    const lines = settingLines(prepared.output.config)
    const labels = [...lines.map((line) => line.label), DONE_LABEL]
    const answer = await ctx.ui.select(SETTINGS_TITLE, labels)
    const line = lines.find((_entry, index) => labels[index] === answer)
    if (!line) return
    await line.edit({ ctx, deps, context, state: prepared.output })
  }
}
