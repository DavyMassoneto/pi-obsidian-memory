import type {
  CompactionEntryDraft,
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  TurnEndEvent,
  TurnEndEventResult,
} from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"
import {
  COMPACTION_DETAILS_TYPE,
  type CompactSessionResult,
  type CycleSettings,
  compactionDue,
  idealCutId,
  retriedByPi,
} from "#src/usecases"
import {
  COMPACTION_DONE,
  COMPACTION_FAILED,
  COMPACTION_FALLBACK,
  COMPACTION_NOT_DONE,
  COMPACTION_STARTED,
  OBSERVER_UNEXPECTED,
} from "./constants.ts"
import { tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { ObservationRuntime } from "./runtime.ts"
import type { AgentEndHandler, AgentStartHandler, BeforeCompactHandler, TurnEndHandler } from "./types.ts"

export function agentStartHandler(runtime: ObservationRuntime): AgentStartHandler {
  return async (_event, ctx) => {
    await runtime.tick(ctx)
  }
}

export function agentEndHandler(runtime: ObservationRuntime): AgentEndHandler {
  return (_event, ctx) => confirmCompaction(runtime, ctx)
}

export function turnEndHandler(runtime: ObservationRuntime): TurnEndHandler {
  return async (event, ctx) => {
    confirmCompaction(runtime, ctx)
    await runtime.tick(ctx)
    return await compactWhenDue(runtime, event, ctx)
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

function confirmCompaction(runtime: ObservationRuntime, ctx: MemoryPiContext): void {
  if (runtime.compaction.confirm(ctx.sessionManager.getBranch())) tell(ctx, COMPACTION_DONE, "info")
}

function compactionSignal(runtime: ObservationRuntime, ctx: MemoryPiContext): AbortSignal {
  const run = ctx.signal
  if (!run) return runtime.signal
  return AbortSignal.any([runtime.signal, run])
}

async function compactWhenDue(
  runtime: ObservationRuntime,
  event: TurnEndEvent,
  ctx: MemoryPiContext,
): Promise<TurnEndEventResult | undefined> {
  const settings = await runtime.settings(ctx)
  if (!settings || runtime.compaction.running || event.outcome === "aborted" || retriedInPi(event)) return undefined
  const { atContextTokens, tailTokens } = settings.compaction
  const { chunkTokens } = settings.observer
  const records = recordsOf(ctx.sessionManager.getBranch())
  if (!runtime.compaction.retryDue(records, chunkTokens)) return undefined
  const due = compactionDue({ contextTokens: contextTokens(ctx), records, atContextTokens, tailTokens, chunkTokens })
  if (!due) return undefined
  const signal = compactionSignal(runtime, ctx)
  if (signal.aborted) return undefined
  tell(ctx, COMPACTION_STARTED, "info")
  const draft = await runtime.compaction.attempt(records, event.messageEntryId, signal, () =>
    compactionDraft(runtime, ctx, settings, signal),
  )
  if (!draft || signal.aborted) return undefined
  return { entries: [...event.entries, draft] }
}

async function compactionDraft(
  runtime: ObservationRuntime,
  ctx: MemoryPiContext,
  settings: CycleSettings,
  signal: AbortSignal,
): Promise<CompactionEntryDraft | null> {
  try {
    return await buildDraft(runtime, ctx, settings, signal)
  } catch (error) {
    let problem = OBSERVER_UNEXPECTED
    if (error instanceof Error) problem = error.message
    if (!signal.aborted) tell(ctx, `${COMPACTION_NOT_DONE} ${problem}`, "warning")
    return null
  }
}

async function buildDraft(
  runtime: ObservationRuntime,
  ctx: MemoryPiContext,
  settings: CycleSettings,
  signal: AbortSignal,
): Promise<CompactionEntryDraft | null> {
  const result = await prepareCompaction(runtime, ctx, settings, signal)
  if (!result || signal.aborted) return null
  if (!result.succeeded) {
    tell(ctx, `${COMPACTION_NOT_DONE} ${result.problems.join("; ")}`, "warning")
    return null
  }
  return {
    type: "compaction",
    summary: result.output.summary,
    firstKeptEntryId: result.output.firstKeptEntryId,
    details: { type: COMPACTION_DETAILS_TYPE },
  }
}

async function buildCompaction(
  runtime: ObservationRuntime,
  event: SessionBeforeCompactEvent,
  ctx: MemoryPiContext,
): Promise<SessionBeforeCompactResult | undefined> {
  const settings = await runtime.settings(ctx)
  if (!settings) return undefined
  const result = await prepareCompaction(runtime, ctx, settings, event.signal)
  if (event.signal.aborted) return { cancel: true }
  if (!result) return undefined
  return compactionOutcome(event, ctx, result)
}

async function prepareCompaction(
  runtime: ObservationRuntime,
  ctx: MemoryPiContext,
  settings: CycleSettings,
  signal: AbortSignal,
): Promise<CompactSessionResult | null> {
  if (signal.aborted) return null
  const until = idealCutId(recordsOf(ctx.sessionManager.getBranch()), settings.compaction.tailTokens)
  if (typeof until === "string") await runtime.observeBeforeCut(ctx, until, signal)
  await runtime.rectification.runUntil(ctx, settings, signal)
  if (signal.aborted) return null
  return runtime.compactSession(ctx, signal)
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
