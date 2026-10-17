import {
  CURRENT_MARK,
  DECISION_TITLE,
  EMBEDDING_CHOICES,
  EMBEDDINGS_TITLE,
  JEV_DISCLOSURE,
  JEV_OPTION,
  LAYA_DEFAULT_ENDPOINT,
  LAYA_ENDPOINT_TITLE,
  LAYA_OPTION,
  REMOTE_EMBEDDINGS_DISCLOSURE,
} from "./constants.ts"
import { saveChange } from "./save.ts"
import type { SettingsEnv } from "./types.ts"

async function askEndpoint(env: SettingsEnv): Promise<string | null> {
  let placeholder = LAYA_DEFAULT_ENDPOINT
  const { decisionModel } = env.state.config
  if (decisionModel.provider === "laya") placeholder = decisionModel.endpoint
  const answer = await env.ctx.ui.input(LAYA_ENDPOINT_TITLE, placeholder)
  if (typeof answer !== "string") return null
  const typed = answer.trim()
  if (typed !== "") return typed
  if (decisionModel.provider === "laya") return decisionModel.endpoint
  return null
}

async function useLaya(env: SettingsEnv): Promise<void> {
  const endpoint = await askEndpoint(env)
  if (typeof endpoint !== "string") return
  await saveChange(env, {
    change: { kind: "decision", provider: "laya", endpoint },
    what: "decision model is now Laya (local). It ships no cutoffs: set the gate and relevance cutoffs here, or per-message memory stays off",
    reload: false,
  })
}

async function useJev(env: SettingsEnv): Promise<void> {
  env.ctx.ui.notify(JEV_DISCLOSURE, "warning")
  await saveChange(env, {
    change: { kind: "decision", provider: "typesafe" },
    what: "decision model is now Jev. The cutoffs start from TypeSafe's values (0.5 and 0.5)",
    reload: false,
  })
}

export async function decisionEdit(env: SettingsEnv): Promise<void> {
  const jevCurrent = env.state.config.decisionModel.provider === "typesafe"
  let options = [`${JEV_OPTION} ${CURRENT_MARK}`, LAYA_OPTION]
  if (!jevCurrent) options = [`${LAYA_OPTION} ${CURRENT_MARK}`, JEV_OPTION]
  const answer = await env.ctx.ui.select(DECISION_TITLE, options)
  if (typeof answer !== "string" || !options.includes(answer)) return
  if (answer.startsWith(JEV_OPTION)) {
    if (!jevCurrent) await useJev(env)
    return
  }
  await useLaya(env)
}

export async function embeddingsEdit(env: SettingsEnv): Promise<void> {
  const current = env.state.config.embeddings
  const same = (provider: string) => provider === current.provider
  const labels = EMBEDDING_CHOICES.filter((choice) => same(choice.value.provider)).map(
    (choice) => `${choice.label} ${CURRENT_MARK}`,
  )
  const others = EMBEDDING_CHOICES.filter((choice) => !same(choice.value.provider))
  const options = [...labels, ...others.map((choice) => choice.label)]
  const answer = await env.ctx.ui.select(EMBEDDINGS_TITLE, options)
  const picked = others.find((choice) => choice.label === answer)
  if (!picked) return
  if (picked.value.provider !== "local") env.ctx.ui.notify(REMOTE_EMBEDDINGS_DISCLOSURE, "warning")
  await saveChange(env, {
    change: { kind: "embeddings", embeddings: picked.value },
    what: `embeddings are now ${picked.label}`,
    reload: false,
  })
}
