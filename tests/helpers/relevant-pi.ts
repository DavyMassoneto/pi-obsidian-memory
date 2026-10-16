import { vi } from "vitest"

import type { CompletionPort } from "#src/services"
import { scriptedLaya } from "./laya-script.ts"
import { registerFakePiAt } from "./pi.ts"
import { piMemoryFixture } from "./pi-memory.ts"
import { writeAgentConfig } from "./pi-registration.ts"
import { layaModel, retrievedInput } from "./relevant-memory.ts"
import type { LayaAsk, RelevantPiOptions, RetrievalStep } from "./types.ts"

const SESSION_QUERY = "Memory relevant to starting work on"

function finishEmpty() {
  return JSON.stringify({ action: "finish", notes: [] })
}

export function routedCompletion(session: RetrievalStep[], turns: RetrievalStep[]) {
  const sessionSteps = [...session]
  const turnSteps = [...turns]
  return vi.fn<CompletionPort>(async (request) => {
    const input = retrievedInput(request)
    let queue = turnSteps
    if (input.query.startsWith(SESSION_QUERY)) queue = sessionSteps
    const step = queue.shift()
    if (!step) return { status: "completed", text: finishEmpty() }
    if (typeof step === "function") return { status: "completed", text: JSON.stringify(step(input)) }
    return { status: "completed", text: JSON.stringify(step) }
  })
}

export async function relevantPiFixture(options: RelevantPiOptions) {
  const fixture = await piMemoryFixture()
  let decisionModel = fixture.config.decisionModel
  let asked: LayaAsk[] = []
  if (options.laya) {
    const laya = await scriptedLaya(options.laya)
    asked = laya.asked
    decisionModel = layaModel(laya.endpoint)
  }
  if (options.endpoint) decisionModel = layaModel(options.endpoint)
  if (options.decisionModel) decisionModel = options.decisionModel
  let budgetChars = fixture.config.context.budgetChars
  if (typeof options.budgetChars === "number") budgetChars = options.budgetChars
  const config = { ...fixture.config, decisionModel, context: { budgetChars } }
  await writeAgentConfig(fixture.configPath, JSON.stringify(config))
  const complete = routedCompletion(options.session, options.turns)
  const pi = registerFakePiAt(fixture.agentDir, {}, { completionOf: () => complete })
  return { ...fixture, pi, complete, asked }
}
