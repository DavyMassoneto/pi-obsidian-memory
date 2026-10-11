import { createHash } from "node:crypto"
import { createServer } from "node:http"

import { vi } from "vitest"

import type {
  EmbeddingOperationContext,
  LocalModel,
  LocalModelLoader,
  LocalModelOptions,
  ModelAsset,
  ModelAssetTransport,
  RemoteEmbeddingContext,
} from "#/services"

export interface RecordedEmbeddingHeaders {
  authorization: string | undefined
  "x-goog-api-key": string | string[] | undefined
  cookie: string | undefined
}

export interface RecordedEmbeddingRequest {
  url: string | undefined
  headers: RecordedEmbeddingHeaders
  body: string
}

export async function embeddingServer(responses: readonly string[], status?: number, delayMs?: number) {
  const requests: RecordedEmbeddingRequest[] = []
  let statusCode = 200
  if (typeof status === "number") {
    statusCode = status
  }
  const server = createServer(async (request, response) => {
    const parts: Buffer[] = []
    for await (const part of request) {
      if (Buffer.isBuffer(part)) {
        parts.push(part)
      }
    }
    requests.push({
      url: request.url,
      headers: {
        authorization: request.headers.authorization,
        "x-goog-api-key": request.headers["x-goog-api-key"],
        cookie: request.headers.cookie,
      },
      body: Buffer.concat(parts).toString("utf8"),
    })
    const body = responses[(requests.length - 1) % responses.length]
    setTimeout(() => {
      response.writeHead(statusCode, { "content-type": "application/json" })
      response.end(body)
    }, delayMs)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Test server has no port")
  }
  return {
    endpoint: `http://127.0.0.1:${address.port}/embeddings`,
    requests,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }),
      )
    },
  }
}

export function embeddingOperation(): EmbeddingOperationContext {
  return { signal: new AbortController().signal, timeoutMs: 5000 }
}

export function remoteEmbeddingContext(endpoint: string): RemoteEmbeddingContext {
  return { ...embeddingOperation(), endpoint, apiKey: "synthetic-test-key" }
}

export function embeddingVector(dimensions: number, position?: number): number[] {
  const vector = Array<number>(dimensions).fill(0)
  let index = 0
  if (typeof position === "number") {
    index = position
  }
  vector[index] = 2
  return vector
}

export function openAIResponse(indices: readonly number[]): string {
  return JSON.stringify({
    object: "list",
    model: "text-embedding-3-small",
    data: indices.map((index) => ({ object: "embedding", index, embedding: embeddingVector(1536, index) })),
    usage: { prompt_tokens: 3, total_tokens: 3 },
  })
}

export function googleResponse(): string {
  return JSON.stringify({ embedding: { values: embeddingVector(768) } })
}

export function localModelDouble() {
  const loads: LocalModelOptions[] = []
  const texts: string[] = []
  let disposalCount = 0
  const model: LocalModel = {
    countTokens(text) {
      return [...text].length + 2
    },
    async extract(text) {
      texts.push(text)
      return embeddingVector(384)
    },
    async dispose() {
      disposalCount += 1
    },
  }
  const loader: LocalModelLoader = async (options) => {
    loads.push(options)
    return model
  }
  return { loads, texts, model, loader, isDisposed: () => disposalCount > 0, disposalCount: () => disposalCount }
}

export function controlledLocalModelLoader() {
  const first = localModelDouble()
  const next = localModelDouble()
  const firstLoad = Promise.withResolvers<LocalModel>()
  const started = Promise.withResolvers<void>()
  const loads: LocalModelOptions[] = []
  const disposalsBeforeNextLoad: number[] = []
  const loader: LocalModelLoader = async (options) => {
    loads.push(options)
    if (loads.length === 1) {
      started.resolve()
      return firstLoad.promise
    }
    disposalsBeforeNextLoad.push(first.disposalCount())
    return next.model
  }
  return { first, next, firstLoad, started: started.promise, loads, disposalsBeforeNextLoad, loader }
}

export function syntheticModelAsset(text: string): ModelAsset {
  return {
    path: "config.json",
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
  }
}

export function syntheticAssetTransport(endpoint: string): ModelAssetTransport {
  return (request) => fetch(endpoint, { signal: request.signal, redirect: "error" })
}

export const syntheticExtraction = vi.fn(async () => ({ dims: [1, 384], data: new Float32Array(embeddingVector(384)) }))
export const syntheticDispose = vi.fn(async () => {})
export const syntheticEncode = vi.fn((text: string) => [...text].map((_, index) => index))
export const syntheticPipeline = vi.fn(async () =>
  Object.assign(syntheticExtraction, { tokenizer: { encode: syntheticEncode }, dispose: syntheticDispose }),
)

export function recordedEmbeddingBody(request: RecordedEmbeddingRequest | undefined): string {
  if (!request) {
    throw new Error("Expected an embedding request")
  }
  return request.body
}
