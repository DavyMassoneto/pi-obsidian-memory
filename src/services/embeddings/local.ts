import { type EmbeddingBatchRequest, type EmbeddingResult, localEmbeddingConfiguration } from "#src/domain"
import { finishEmbeddingBatch } from "./batch.ts"
import { prepareChunks, validateEmbeddingRequest } from "./chunks.ts"
import { getSharedLocalModel } from "./local-model-load.ts"
import { acquireLocalModel, releaseLocalModel } from "./local-model-registry.ts"
import { runEmbeddingOperation } from "./operation.ts"
import type {
  LocalEmbedder,
  LocalEmbeddingOptions,
  LocalEmbeddingState,
  LocalModel,
  LocalModelResult,
  ParsedVectors,
  PreparedChunk,
} from "./types.ts"

export function createLocalEmbedder(options: LocalEmbeddingOptions): LocalEmbedder {
  const state: LocalEmbeddingState = {
    options: { ...options },
    lease: null,
    settled: Promise.resolve(),
    disposal: null,
    lifetime: new AbortController(),
  }
  return {
    embed(context, request) {
      return runEmbeddingOperation(context, (signal) => enqueueLocalEmbedding(state, request, signal))
    },
    dispose() {
      if (!state.disposal) {
        const lease = state.lease
        state.lease = null
        state.disposal = state.settled
        if (lease) state.disposal = releaseLocalModel(lease, state.settled)
        state.lifetime.abort()
      }
      return state.disposal
    },
  }
}

async function enqueueLocalEmbedding(
  state: LocalEmbeddingState,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  if (state.disposal || state.options.cachePath.trim().length === 0) {
    return { succeeded: false, status: "unavailable" }
  }
  const invalid = validateEmbeddingRequest(request)
  if (invalid) return invalid
  if (!state.lease) state.lease = acquireLocalModel(state.options)
  const { entry } = state.lease
  const interest = AbortSignal.any([signal, state.lifetime.signal])
  const model = getSharedLocalModel(entry, state.options, interest)
  const pending = entry.queue.then(() => embedWhenReady(state, request, signal, model))
  entry.queue = pending.then(
    () => {},
    () => {},
  )
  state.settled = entry.queue
  return pending
}

async function embedWhenReady(
  state: LocalEmbeddingState,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
  pending: Promise<LocalModelResult>,
): Promise<EmbeddingResult> {
  const model = await pending
  signal.throwIfAborted()
  if (state.disposal) return { succeeded: false, status: "unavailable" }
  if (!model.succeeded) return model
  return embedLocally(model.output, request, signal)
}

async function embedLocally(
  model: LocalModel,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  let prefix = "passage: "
  if (request.purpose === "query") {
    prefix = "query: "
  }

  const chunks = prepareChunks(request, {
    maximum: 512,
    overlap: 32,
    measure: (text) => model.countTokens(text),
    prefix,
  })
  if (!chunks.succeeded) {
    return chunks
  }

  const vectors = await extractLocalChunks(model, chunks.output, signal)
  if (!vectors.succeeded) {
    return vectors
  }

  return finishEmbeddingBatch(localEmbeddingConfiguration, request, chunks.output, vectors.output)
}

async function extractLocalChunks(
  model: LocalModel,
  chunks: readonly PreparedChunk[],
  signal: AbortSignal,
): Promise<ParsedVectors> {
  const output: number[][] = []
  for (const chunk of chunks) {
    signal.throwIfAborted()
    const vector = await model.extract(chunk.text)
    if (!vector) {
      return { succeeded: false, status: "invalid-response" }
    }
    output.push([...vector])
  }
  signal.throwIfAborted()
  return { succeeded: true, output }
}
