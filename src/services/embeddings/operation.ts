import type { EmbeddingFailure, EmbeddingResult } from "#src/domain"
import { EmbeddingResourceError } from "./errors.ts"
import type { EmbeddingOperation, EmbeddingOperationContext } from "./types.ts"

export async function runEmbeddingOperation(
  context: EmbeddingOperationContext,
  operation: EmbeddingOperation,
): Promise<EmbeddingResult> {
  if (context.signal.aborted) {
    return { succeeded: false, status: "aborted" }
  }
  if (!Number.isSafeInteger(context.timeoutMs) || context.timeoutMs < 1 || context.timeoutMs > 2_147_483_647) {
    return { succeeded: false, status: "invalid-input" }
  }
  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(), context.timeoutMs)
  const signal = AbortSignal.any([context.signal, deadline.signal])
  let cancel = () => {}
  const aborted = new Promise<EmbeddingFailure>((resolve) => {
    cancel = () => resolve(cancellationStatus(context.signal))
    signal.addEventListener("abort", cancel, { once: true })
  })
  try {
    return await Promise.race([operation(signal), aborted])
  } catch (error) {
    if (signal.aborted) {
      return cancellationStatus(context.signal)
    }
    if (error instanceof EmbeddingResourceError) {
      return error.failure
    }
    return { succeeded: false, status: "unavailable" }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", cancel)
  }
}

function cancellationStatus(signal: AbortSignal): EmbeddingFailure {
  if (signal.aborted) {
    return { succeeded: false, status: "aborted" }
  }
  return { succeeded: false, status: "deadline" }
}
