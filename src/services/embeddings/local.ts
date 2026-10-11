import { type EmbeddingBatchRequest, type EmbeddingResult, localEmbeddingConfiguration } from "#/domain"
import { finishEmbeddingBatch } from "./batch.ts"
import { prepareChunks, validateEmbeddingRequest } from "./chunks.ts"
import { runEmbeddingOperation } from "./operation.ts"
import { loadLocalModel } from "./runtime.ts"
import type {
  LocalEmbedder,
  LocalEmbeddingOptions,
  LocalEmbeddingState,
  LocalModel,
  ParsedVectors,
  PreparedChunk,
} from "./types.ts"

export function createLocalEmbedder(options: LocalEmbeddingOptions): LocalEmbedder {
  const state: LocalEmbeddingState = { options: { ...options }, model: null, queue: Promise.resolve(), disposed: false }
  return {
    embed(context, request) {
      return runEmbeddingOperation(context, (signal) => enqueueLocalEmbedding(state, request, signal))
    },
    async dispose() {
      state.disposed = true
      await state.queue
      if (state.model) {
        const model = await state.model.catch(() => null)
        if (model) {
          await model.dispose()
        }
        state.model = null
      }
    },
  }
}

function enqueueLocalEmbedding(
  state: LocalEmbeddingState,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  const pending = state.queue.then(() => embedLocally(state, request, signal))
  state.queue = pending.then(
    () => {},
    () => {},
  )
  return pending
}

async function getLocalModel(state: LocalEmbeddingState, signal: AbortSignal): Promise<LocalModel> {
  if (!state.model) {
    let loader = loadLocalModel
    if (state.options.loadModel) {
      loader = state.options.loadModel
    }
    const options = { cachePath: state.options.cachePath, downloadConsent: state.options.downloadConsent, signal }
    if (state.options.onProgress) {
      state.model = loader({ ...options, onProgress: state.options.onProgress })
    } else {
      state.model = loader(options)
    }
  }
  return state.model
}

async function embedLocally(
  state: LocalEmbeddingState,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  signal.throwIfAborted()
  if (state.disposed || state.options.cachePath.trim().length === 0) {
    return { succeeded: false, status: "unavailable" }
  }
  const invalid = validateEmbeddingRequest(request)
  if (invalid) {
    return invalid
  }
  const model = await getLocalModel(state, signal)
  signal.throwIfAborted()
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
