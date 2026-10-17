import type { MemoryPiContext, MemoryStatus, StatusWork } from "./types.ts"

export async function withMemoryStatus<Result>(
  ctx: MemoryPiContext,
  status: MemoryStatus,
  work: StatusWork<Result>,
): Promise<Result> {
  if (!ctx.hasUI) return work()
  ctx.ui.setStatus(status.key, status.text)
  try {
    return await work()
  } finally {
    ctx.ui.setStatus(status.key, undefined)
  }
}
