import type { CompletionLifetime, FailedResponse } from "./types.ts"

export function completionLifetime(signal: AbortSignal): CompletionLifetime {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal.addEventListener("abort", onAbort, { once: true })
  const stopped = new Promise<FailedResponse>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve({ status: "aborted" }), { once: true })
  })
  if (signal.aborted) controller.abort()
  return {
    signal: controller.signal,
    stopped,
    dispose: () => signal.removeEventListener("abort", onAbort),
  }
}
