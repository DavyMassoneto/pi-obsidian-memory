import type { CompletionLifetime, CompletionTiming, FailedResponse } from "./types.ts"

export function completionLifetime(context: CompletionTiming, duration: number): CompletionLifetime {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(duration, context.deadline - Date.now()))
  const onAbort = () => controller.abort()
  context.signal.addEventListener("abort", onAbort, { once: true })
  const stopped = new Promise<FailedResponse>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve({ status: "aborted" }), { once: true })
  })
  if (context.signal.aborted) controller.abort()
  return {
    signal: controller.signal,
    stopped,
    dispose: () => {
      clearTimeout(timeout)
      context.signal.removeEventListener("abort", onAbort)
    },
  }
}
