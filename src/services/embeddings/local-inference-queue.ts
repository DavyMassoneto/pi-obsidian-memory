import type { EmbeddingResult, LocalInference, QueuedLocalInference, SharedLocalModel } from "./types.ts"

export function enqueueLocalInference(
  entry: SharedLocalModel,
  interest: AbortSignal,
  signal: AbortSignal,
  run: LocalInference,
): Promise<EmbeddingResult> {
  const { promise, resolve, reject } = Promise.withResolvers<EmbeddingResult>()
  const cancel = () => {
    entry.waiting.delete(job)
    if (signal.aborted) resolve({ succeeded: false, status: "aborted" })
    else resolve({ succeeded: false, status: "unavailable" })
  }
  const job: QueuedLocalInference = {
    async start() {
      interest.removeEventListener("abort", cancel)
      if (interest.aborted) return
      try {
        resolve(await run())
      } catch (error) {
        reject(error)
      }
    },
  }
  if (interest.aborted) {
    cancel()
    return promise
  }
  entry.waiting.add(job)
  interest.addEventListener("abort", cancel, { once: true })
  startNextInference(entry)
  return promise
}

function startNextInference(entry: SharedLocalModel): void {
  if (entry.running || entry.retirement) return
  const next = entry.waiting.values().next()
  if (next.done) return
  entry.waiting.delete(next.value)
  entry.running = Promise.resolve()
    .then(() => next.value.start())
    .finally(() => {
      entry.running = null
      startNextInference(entry)
    })
}
