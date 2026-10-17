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
  const { signal } = context
  let cancel = () => {}
  const aborted = new Promise<EmbeddingFailure>((resolve) => {
    cancel = () => resolve({ succeeded: false, status: "aborted" })
    signal.addEventListener("abort", cancel, { once: true })
  })
  try {
    return await Promise.race([operation(signal), aborted])
  } catch (error) {
    if (signal.aborted) {
      return { succeeded: false, status: "aborted" }
    }
    if (error instanceof EmbeddingResourceError) {
      return error.failure
    }
    return { succeeded: false, status: "unavailable" }
  } finally {
    signal.removeEventListener("abort", cancel)
  }
}
