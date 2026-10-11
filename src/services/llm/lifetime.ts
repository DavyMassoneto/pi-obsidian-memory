import type { CompletionLifetime, CompletionTiming, FailedResponse } from "./types.ts"

export function completionLifetime(context: CompletionTiming, duration: number): CompletionLifetime {
  const start = Date.now()
  const deadline = Math.min(context.deadline, start + duration)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), deadline - start)
  const onAbort = () => controller.abort()
  context.signal.addEventListener("abort", onAbort, { once: true })
  const stopped = new Promise<FailedResponse>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve({ status: "aborted" }), { once: true })
  })
  if (context.signal.aborted) controller.abort()
  return {
    deadline,
    signal: controller.signal,
    stopped,
    dispose: () => {
      clearTimeout(timeout)
      context.signal.removeEventListener("abort", onAbort)
    },
  }
}
