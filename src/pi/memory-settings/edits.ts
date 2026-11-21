import { parseSettingNumber } from "#src/usecases"
import { NONE_WORD } from "./constants.ts"
import { chooseModel } from "./models.ts"
import { saveChange } from "./save.ts"
import type { LineEdit, ModelEditSpec, NumberEditSpec, SwitchEditSpec } from "./types.ts"

export function modelEdit(spec: ModelEditSpec): LineEdit {
  return async (env) => {
    const chosen = await chooseModel(env.ctx, spec.title, spec.current, {})
    if (!chosen) return
    if (chosen.provider === spec.current.provider && chosen.id === spec.current.id) return
    await saveChange(env, {
      change: { kind: spec.kind, model: chosen },
      what: `${spec.what} is now ${chosen.provider}/${chosen.id}`,
      reload: false,
    })
  }
}

export function switchEdit(spec: SwitchEditSpec): LineEdit {
  return async (env) => {
    const value = !spec.current
    let state = "off"
    if (value) state = "on"
    await saveChange(env, {
      change: { kind: "captureSwitch", name: spec.name, value },
      what: `${spec.what} is now ${state}`,
      reload: false,
    })
  }
}

export function numberEdit(spec: NumberEditSpec): LineEdit {
  return async (env) => {
    const answer = await env.ctx.ui.input(spec.title, spec.current)
    if (typeof answer !== "string" || answer.trim() === "") return
    const typed = answer.trim()
    if (spec.clear && typed.toLowerCase() === NONE_WORD) {
      await saveChange(env, { change: spec.clear, what: `${spec.what} is now not set`, reload: false })
      return
    }
    const parsed = parseSettingNumber(typed, spec.kind)
    if (!parsed.succeeded) return env.ctx.ui.notify(`${spec.what}: ${parsed.problems.join("; ")}`, "error")
    await saveChange(env, { change: spec.change(parsed.output), what: `${spec.what} is now ${typed}`, reload: false })
  }
}
