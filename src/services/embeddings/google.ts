import { type EmbeddingBatchRequest, type EmbeddingResult, googleEmbeddingConfiguration } from "#/domain"
import { finishEmbeddingBatch } from "./batch.ts"
import { prepareChunks } from "./chunks.ts"
import { postEmbedding } from "./http.ts"
import { runEmbeddingOperation } from "./operation.ts"
import { parseGoogleEmbedding } from "./responses.ts"
import type { ParsedVectors, PreparedChunk, RemoteEmbeddingContext } from "./types.ts"

export function embedGoogle(context: RemoteEmbeddingContext, request: EmbeddingBatchRequest): Promise<EmbeddingResult> {
  return runEmbeddingOperation(context, (signal) => embedGoogleBatch(context, request, signal))
}

async function embedGoogleBatch(
  context: RemoteEmbeddingContext,
  request: EmbeddingBatchRequest,
  signal: AbortSignal,
): Promise<EmbeddingResult> {
  const chunks = prepareChunks(request, {
    maximum: 1024,
    overlap: 128,
    measure: (text) => Buffer.byteLength(text, "utf8"),
    prefix: "",
  })
  if (!chunks.succeeded) {
    return chunks
  }
  const vectors = await requestGoogleChunks(context, request.purpose, chunks.output, signal)
  if (!vectors.succeeded) {
    return vectors
  }
  return finishEmbeddingBatch(googleEmbeddingConfiguration, request, chunks.output, vectors.output)
}

async function requestGoogleChunks(
  context: RemoteEmbeddingContext,
  purpose: EmbeddingBatchRequest["purpose"],
  chunks: readonly PreparedChunk[],
  signal: AbortSignal,
): Promise<ParsedVectors> {
  const output: number[][] = []
  for (let start = 0; start < chunks.length; start += 2) {
    signal.throwIfAborted()
    const group = chunks.slice(start, start + 2)
    const responses = await Promise.all(group.map((chunk) => requestGoogle(context, chunk.text, purpose, signal)))
    for (const response of responses) {
      if (!response.succeeded) {
        return response
      }
      output.push(...response.output)
    }
  }
  return { succeeded: true, output }
}

async function requestGoogle(
  context: RemoteEmbeddingContext,
  text: string,
  purpose: EmbeddingBatchRequest["purpose"],
  signal: AbortSignal,
): Promise<ParsedVectors> {
  let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
  if (typeof context.endpoint === "string") {
    endpoint = context.endpoint
  }
  let taskType = "RETRIEVAL_DOCUMENT"
  if (purpose === "query") {
    taskType = "RETRIEVAL_QUERY"
  }
  const response = await postEmbedding({
    endpoint,
    apiKey: context.apiKey,
    provider: "google",
    signal,
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: 768,
      embedContentConfig: { autoTruncate: false },
    }),
  })
  if (!response.succeeded) {
    return response
  }
  return parseGoogleEmbedding(response.output)
}
