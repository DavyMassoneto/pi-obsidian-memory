import { OBSERVER_RETRY_MS } from "./constants.ts"
import { uncoveredSpans } from "./coverage.ts"
import { isCutPoint, isSourceRecord } from "./records.ts"
import type { ChunkPlanRequest, ChunkRange, ChunkSlice, FailedChunk, SessionRecord, Span } from "./types.ts"

export function retryDue(failure: FailedChunk, nowMs: number): boolean {
  return nowMs - failure.failedAtMs >= OBSERVER_RETRY_MS
}

function slicesOf(records: SessionRecord[], span: Span, chunkTokens: number): ChunkSlice[] {
  const slices: ChunkSlice[] = []
  let current: ChunkSlice | null = null
  for (const record of records.slice(span.from, span.to + 1)) {
    if (!isSourceRecord(record)) continue
    if (current && current.tokens + record.tokens > chunkTokens && isCutPoint(record)) {
      slices.push(current)
      current = null
    }
    if (current) {
      current.coversUpToId = record.id
      current.tokens += record.tokens
      continue
    }
    current = { fromId: record.id, coversUpToId: record.id, tokens: record.tokens }
  }
  if (current) slices.push(current)
  return slices
}

function whileFullChunkRemains(slices: ChunkSlice[], chunkTokens: number): ChunkSlice[] {
  let remaining = slices.reduce((sum, slice) => sum + slice.tokens, 0)
  const planned: ChunkSlice[] = []
  for (const slice of slices) {
    if (remaining >= chunkTokens) planned.push(slice)
    remaining -= slice.tokens
  }
  return planned
}

function cutLimit(request: ChunkPlanRequest): number {
  if (!request.until) return request.records.length
  return request.records.findIndex((record) => record.id === request.until)
}

function spansToPlan(request: ChunkPlanRequest): Span[] {
  const limit = cutLimit(request)
  return uncoveredSpans(request.records, request.ledger, request.inFlight)
    .filter((span) => span.from < limit)
    .map((span) => ({ ...span, to: Math.min(span.to, limit - 1) }))
}

function isSkipped(request: ChunkPlanRequest, span: Span): boolean {
  const firstId = request.records[span.from]?.id
  if (request.until) return request.attempted.some((id) => id === firstId)
  return request.failed.some((failure) => failure.fromId === firstId && !retryDue(failure, request.nowMs))
}

function slicesToPlan(request: ChunkPlanRequest, span: Span): ChunkSlice[] {
  const slices = slicesOf(request.records, span, request.chunkTokens)
  if (request.until || span.closed) return slices
  return whileFullChunkRemains(slices, request.chunkTokens)
}

export function planObserverChunks(request: ChunkPlanRequest): ChunkRange[] {
  const slots = request.concurrency - request.inFlight.length
  const planned: ChunkRange[] = []
  if (slots <= 0) return planned
  for (const span of spansToPlan(request)) {
    if (isSkipped(request, span)) continue
    for (const slice of slicesToPlan(request, span)) {
      planned.push({ fromId: slice.fromId, coversUpToId: slice.coversUpToId })
      if (planned.length >= slots) return planned
    }
  }
  return planned
}
