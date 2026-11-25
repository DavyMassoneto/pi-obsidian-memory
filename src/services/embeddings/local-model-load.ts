import { EmbeddingResourceError } from "./errors.ts"
import { loadLocalModel } from "./runtime.ts"
import type { DownloadProgress, LocalEmbeddingOptions, LocalModelResult, SharedLocalModel } from "./types.ts"

export function getSharedLocalModel(
  entry: SharedLocalModel,
  options: LocalEmbeddingOptions,
  interest: AbortSignal,
): Promise<LocalModelResult> {
  let onProgress = options.onProgress
  const listener = (progress: DownloadProgress) => {
    try {
      onProgress?.(progress)
    } catch {
      onProgress = undefined
    }
  }
  const unsubscribe = () => {
    interest.removeEventListener("abort", unsubscribe)
    entry.interests.delete(listener)
    if (entry.interests.size === 0) entry.loading?.abort()
  }
  entry.interests.add(listener)
  interest.addEventListener("abort", unsubscribe, { once: true })
  return loadOnce(entry, options).finally(unsubscribe)
}

function loadOnce(entry: SharedLocalModel, options: LocalEmbeddingOptions): Promise<LocalModelResult> {
  const previous = entry.model
  if (previous && !entry.loading?.signal.aborted) return previous

  const controller = new AbortController()
  entry.loading = controller
  entry.model = loadAfterPrevious(entry, options, controller, previous)
  return entry.model
}

async function loadAfterPrevious(
  entry: SharedLocalModel,
  options: LocalEmbeddingOptions,
  controller: AbortController,
  previous: Promise<LocalModelResult> | null,
): Promise<LocalModelResult> {
  const { signal } = controller
  let keepModel = false
  try {
    await entry.beforeLoad
    await previous
    const result = await loadModel(entry, options, signal)
    if (result.succeeded && signal.aborted) {
      await result.output.dispose()
      return { succeeded: false, status: "aborted" }
    }
    keepModel = result.succeeded
    return result
  } catch {
    return { succeeded: false, status: "unavailable" }
  } finally {
    if (entry.loading === controller) {
      entry.loading = null
      if (!keepModel) entry.model = null
    }
  }
}

async function loadModel(
  entry: SharedLocalModel,
  options: LocalEmbeddingOptions,
  signal: AbortSignal,
): Promise<LocalModelResult> {
  const request = {
    cachePath: options.cachePath,
    signal,
    onProgress: (progress: DownloadProgress) => notify(entry, progress),
  }
  let loader = loadLocalModel
  if (options.loadModel) loader = options.loadModel
  try {
    signal.throwIfAborted()
    return { succeeded: true, output: await loader(request) }
  } catch (error) {
    if (signal.aborted) return { succeeded: false, status: "aborted" }
    if (error instanceof EmbeddingResourceError) return error.failure
    return { succeeded: false, status: "unavailable" }
  }
}

function notify(entry: SharedLocalModel, progress: DownloadProgress): void {
  for (const listener of entry.interests) listener(progress)
}
