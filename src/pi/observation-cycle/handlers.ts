import type {
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"
import {
  COMPACTION_DETAILS_TYPE,
  type CompactSessionResult,
  compactionDue,
  idealCutId,
  retriedByPi,
} from "#src/usecases"
import { COMPACTION_FAILED, COMPACTION_FALLBACK } from "./constants.ts"
import { tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { ObservationRuntime } from "./runtime.ts"
import type { AgentStartHandler, BeforeCompactHandler, TurnEndHandler } from "./types.ts"

export function agentStartHandler(runtime: ObservationRuntime): AgentStartHandler {
  return async (_event, ctx) => {
    await runtime.tick(ctx)
  }
}

export function turnEndHandler(runtime: ObservationRuntime): TurnEndHandler {
  return async (event, ctx) => {
    await runtime.tick(ctx)
    await compactWhenDue(runtime, event, ctx)
  }
}

export function beforeCompactHandler(runtime: ObservationRuntime): BeforeCompactHandler {
  return async (event, ctx) => {
    try {
      return await buildCompaction(runtime, event, ctx)
    } catch (error) {
      if (error instanceof Error) tell(ctx, `${COMPACTION_FAILED} ${error.message}`, "warning")
      return undefined
    }
  }
}

function retriedInPi(event: TurnEndEvent): boolean {
  const { message } = event
  if (message.role !== "assistant") return false
  if (typeof message.errorMessage !== "string") return retriedByPi(message.stopReason, null)
  return retriedByPi(message.stopReason, message.errorMessage)
}

function contextTokens(ctx: MemoryPiContext): number | null {
  const usage = ctx.getContextUsage()
  if (!usage) return null
  return usage.tokens
}

async function compactWhenDue(runtime: ObservationRuntime, event: TurnEndEvent, ctx: MemoryPiContext) {
  const settings = await runtime.settings(ctx)
  if (!settings || runtime.compaction.running || retriedInPi(event)) return
  const { atContextTokens, tailTokens } = settings.compaction
  const { chunkTokens } = settings.observer
  const records = recordsOf(ctx.sessionManager.getBranch())
  if (!runtime.compaction.retryDue(records, chunkTokens)) return
  const due = compactionDue({ contextTokens: contextTokens(ctx), records, atContextTokens, tailTokens, chunkTokens })
  if (due) runtime.compaction.run(ctx, event.toolResults.length > 0)
}

async function buildCompaction(
  runtime: ObservationRuntime,
  event: SessionBeforeCompactEvent,
  ctx: MemoryPiContext,
): Promise<SessionBeforeCompactResult | undefined> {
  const settings = await runtime.settings(ctx)
  if (!settings) return undefined
  const until = idealCutId(recordsOf(ctx.sessionManager.getBranch()), settings.compaction.tailTokens)
  if (typeof until === "string") await runtime.observeBeforeCut(ctx, until, event.signal)
  if (event.signal.aborted) return { cancel: true }
  const result = await runtime.compactSession(ctx, event.signal)
  if (!result) return undefined
  return compactionOutcome(event, ctx, result)
}

function compactionOutcome(
  event: SessionBeforeCompactEvent,
  ctx: MemoryPiContext,
  result: CompactSessionResult,
): SessionBeforeCompactResult | undefined {
  if (result.succeeded) {
    const { summary, firstKeptEntryId } = result.output
    const { tokensBefore } = event.preparation
    return { compaction: { summary, firstKeptEntryId, tokensBefore, details: { type: COMPACTION_DETAILS_TYPE } } }
  }
  if (result.reason === "not-observed") tell(ctx, COMPACTION_FALLBACK, "warning")
  else tell(ctx, `${COMPACTION_FAILED} ${result.problems.join("; ")}`, "warning")
  return undefined
}
