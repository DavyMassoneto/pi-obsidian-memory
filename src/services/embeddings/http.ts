import type { EmbeddingHttpRequest, EmbeddingHttpResult } from "./types.ts"

export async function postEmbedding(request: EmbeddingHttpRequest): Promise<EmbeddingHttpResult> {
  if (request.apiKey.trim().length === 0 || !allowedEmbeddingEndpoint(request)) {
    return { succeeded: false, status: "unavailable" }
  }
  const headers = new Headers({ "content-type": "application/json" })
  if (request.provider === "openai") {
    headers.set("authorization", `Bearer ${request.apiKey}`)
  } else {
    headers.set("x-goog-api-key", request.apiKey)
  }
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers,
    body: request.body,
    signal: request.signal,
    redirect: "error",
  })
  if (!response.ok) {
    await response.body?.cancel()
    return { succeeded: false, status: "unavailable" }
  }
  return readEmbeddingBody(response)
}

function allowedEmbeddingEndpoint(request: EmbeddingHttpRequest): boolean {
  const url = new URL(request.endpoint)
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    return false
  }
  if (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname)) {
    return true
  }
  if (request.provider === "openai") {
    return url.href === "https://api.openai.com/v1/embeddings"
  }
  return url.href === "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
}

async function readEmbeddingBody(response: Response): Promise<EmbeddingHttpResult> {
  if (!response.body) {
    return { succeeded: false, status: "invalid-response" }
  }
  const reader = response.body.getReader()
  const buffers: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        return { succeeded: true, output: Buffer.concat(buffers).toString("utf8") }
      }
      length += next.value.byteLength
      if (length > 4_000_000) {
        await reader.cancel()
        return { succeeded: false, status: "invalid-response" }
      }
      buffers.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
}
