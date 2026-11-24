import { Value } from "typebox/value"

import { type MemoryPiContext, STATUS_SEARCHING, withMemoryStatus } from "#src/pi/context"
import type { BeforeAgentStartHandler } from "#src/pi/memory-block"
import {
  deliverSessionMemory,
  type JevSource,
  LoadedChangesSchema,
  loadSessionMemory,
  retrieveMemory,
} from "#src/usecases"
import { JEV_MISSING, RELEVANT_MESSAGE_TYPE } from "./constants.ts"
import { classifierPrompt } from "./prompt.ts"
import type { PendingSessionMemory, RelevantMemoryDeps } from "./types.ts"

export class RelevantMemoryRuntime {
  #deps: RelevantMemoryDeps
  #told = new Set<string>()
  #sessionToken = Symbol()
  #pending: PendingSessionMemory | null = null

  constructor(deps: RelevantMemoryDeps) {
    this.#deps = deps
  }

  reset(): void {
    this.#told = new Set<string>()
    this.#sessionToken = Symbol()
    this.#pending = null
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
    const token = this.#sessionToken
    const result = await loadSessionMemory(operation, { complete: this.#deps.completionOf(ctx) })
    if (!result.succeeded || token !== this.#sessionToken || operation.signal.aborted) return null
    this.tell(ctx, result.output.notices)
    this.#pending = { result: result.output, signal: operation.signal }
    return result.output.text
  }

  sessionBeforeAgentStart(): BeforeAgentStartHandler {
    return async (event) => {
      if (event.messageType !== "user" || !this.#pending) return undefined
      const pending = this.#pending
      this.#pending = null
      if (pending.signal.aborted) return undefined
      const delivered = deliverSessionMemory(pending.result, this.#deps.sessions.loaded())
      if (typeof delivered.text !== "string") return undefined
      return {
        message: {
          customType: RELEVANT_MESSAGE_TYPE,
          content: delivered.text,
          display: false,
          details: delivered.changes,
        },
      }
    }
  }

  beforeAgentStart(): BeforeAgentStartHandler {
    return async (event, ctx) => {
      if (event.messageType !== "user") return undefined
      const operation = this.#deps.sessions.retrievalOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return undefined
      const result = await withMemoryStatus(ctx, STATUS_SEARCHING, () =>
        retrieveMemory({ message: event.prompt }, operation, {
          jev: this.#jevFor(ctx),
          loaded: this.#deps.sessions.loaded(),
        }),
      )
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
}
