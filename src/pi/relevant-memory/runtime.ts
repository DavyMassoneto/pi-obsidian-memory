import { Value } from "typebox/value"

import type { MemoryPiContext } from "#src/pi/context"
import type { BeforeAgentStartHandler } from "#src/pi/memory-block"
import {
  type JevSource,
  LoadedChangesSchema,
  loadSessionMemory,
  prepareDecisionModel,
  retrieveMemory,
} from "#src/usecases"
import {
  JEV_CONFIRM_FAILED,
  JEV_DECLINED,
  JEV_MESSAGE,
  JEV_MISSING,
  JEV_NO_UI,
  JEV_TITLE,
  RELEVANT_MESSAGE_TYPE,
} from "./constants.ts"
import { classifierPrompt } from "./prompt.ts"
import type { RelevantMemoryDeps } from "./types.ts"

export class RelevantMemoryRuntime {
  #deps: RelevantMemoryDeps
  #jevAnswer: Promise<boolean> | null = null
  #told = new Set<string>()

  constructor(deps: RelevantMemoryDeps) {
    this.#deps = deps
  }

  async start(ctx: MemoryPiContext): Promise<void> {
    this.#told = new Set<string>()
    const operation = this.#deps.sessions.retrievalOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return
    const refusal = await prepareDecisionModel(operation, this.#jevFor(ctx))
    if (typeof refusal === "string") this.tell(ctx, [refusal])
  }

  restore(ctx: MemoryPiContext): void {
    const loaded = this.#deps.sessions.loaded()
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom_message" || entry.customType !== RELEVANT_MESSAGE_TYPE) continue
      if (Value.Check(LoadedChangesSchema, entry.details)) loaded.apply(entry.details)
    }
  }

  async sessionText(ctx: MemoryPiContext): Promise<string | null> {
    const operation = this.#deps.sessions.retrievalOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return null
    const result = await loadSessionMemory(operation, {
      complete: this.#deps.completionOf(ctx),
      loaded: this.#deps.sessions.loaded(),
    })
    if (!result.succeeded) return null
    this.tell(ctx, result.output.notices)
    return result.output.text
  }

  beforeAgentStart(): BeforeAgentStartHandler {
    return async (event, ctx) => {
      if (event.messageType !== "user") return undefined
      const operation = this.#deps.sessions.retrievalOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return undefined
      const result = await retrieveMemory({ message: event.prompt }, operation, {
        complete: this.#deps.completionOf(ctx),
        jev: this.#jevFor(ctx),
        loaded: this.#deps.sessions.loaded(),
      })
      if (!result.succeeded) return undefined
      this.tell(ctx, result.output.notices)
      if (typeof result.output.text !== "string") return undefined
      return {
        message: {
          customType: RELEVANT_MESSAGE_TYPE,
          content: result.output.text,
          display: false,
          details: result.output.changes,
        },
      }
    }
  }

  tell(ctx: MemoryPiContext, notices: string[]): void {
    for (const notice of notices) {
      if (this.#told.has(notice)) continue
      this.#told.add(notice)
      if (ctx.hasUI) ctx.ui.notify(notice, "warning")
    }
  }

  #jevFor(ctx: MemoryPiContext): JevSource {
    return async (modelId) => {
      const refusal = await this.#confirmJev(ctx)
      if (refusal) return { available: false, reason: refusal }
      const model = ctx.modelRegistry.findOfType("classifier", "typesafe", modelId)
      if (!model) return { available: false, reason: JEV_MISSING }
      return {
        available: true,
        classifier: {
          classify: (request) => ctx.modelRegistry.classify(model, classifierPrompt(request.context), request.options),
        },
      }
    }
  }

  async #confirmJev(ctx: MemoryPiContext): Promise<string | null> {
    if (!this.#jevAnswer) {
      if (!ctx.hasUI) return JEV_NO_UI
      this.#jevAnswer = ctx.ui.confirm(JEV_TITLE, JEV_MESSAGE)
    }
    try {
      if (await this.#jevAnswer) return null
    } catch (error) {
      if (!(error instanceof Error)) throw error
      this.#jevAnswer = null
      return `${JEV_CONFIRM_FAILED} ${error.message}`
    }
    return JEV_DECLINED
  }
}
