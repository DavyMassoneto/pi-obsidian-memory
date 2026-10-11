import { type EmbeddingBatchRequest, type EmbeddingResult, openAIEmbeddingConfiguration } from "#/domain"
import { finishEmbeddingBatch } from "./batch.ts"
import { prepareChunks } from "./chunks.ts"
import { postEmbedding } from "./http.ts"
import { runEmbeddingOperation } from "./operation.ts"
import { parseOpenAIEmbeddings } from "./responses.ts"
import type { ParsedVectors, PreparedChunk, RemoteEmbeddingContext } from "./types.ts"

export function embedOpenAI(context: RemoteEmbeddingContext, request: EmbeddingBatchRequest): Promise<EmbeddingResult> {
  return runEmbeddingOperation(context, (signal) => embedOpenAIBatch(context, request, signal))
}

async function embedOpenAIBatch(
  context: RemoteEmbeddingContext,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  const chunks = prepareChunks(request, {
    maximum: 4096,
    overlap: 128,
    measure: (text) => Buffer.byteLength(text, "utf8"),
    prefix: "",
  })
  if (!chunks.succeeded) {
    return chunks
  }
  const vectors: number[][] = []
  for (let start = 0; start < chunks.output.length; start += 32) {
    signal.throwIfAborted()
    const response = await requestOpenAI(context, chunks.output.slice(start, start + 32), signal)
    if (!response.succeeded) {
      return response
    }
    vectors.push(...response.output)
  }
  return finishEmbeddingBatch(openAIEmbeddingConfiguration, request, chunks.output, vectors)
}

async function requestOpenAI(
  context: RemoteEmbeddingContext,
  chunks: readonly PreparedChunk[],
  signal: AbortSignal,
): Promise<ParsedVectors> {
  let endpoint = "https://api.openai.com/v1/embeddings"
  if (typeof context.endpoint === "string") {
    endpoint = context.endpoint
  }
  const response = await postEmbedding({
    endpoint,
    apiKey: context.apiKey,
    provider: "openai",
    signal,
    body: JSON.stringify({
      model: openAIEmbeddingConfiguration.model,
      input: chunks.map((chunk) => chunk.text),
      encoding_format: "float",
      dimensions: 1536,
    }),
  })
  if (!response.succeeded) {
    return response
  }
  return parseOpenAIEmbeddings(response.output, chunks.length)
}
