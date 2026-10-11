import type { EmbeddingBatchRequest, EmbeddingFailure } from "#/domain"
import type { ChunkPolicy, PreparedChunk, PreparedChunks } from "./types.ts"

export function validateEmbeddingRequest(request: EmbeddingBatchRequest): EmbeddingFailure | null {
  if (request.inputs.length === 0 || new Set(request.inputs.map((input) => input.key)).size !== request.inputs.length) {
    return { succeeded: false, status: "invalid-input" }
  }
  if (request.inputs.some((input) => input.text.trim().length === 0 || input.key.length === 0)) {
    return { succeeded: false, status: "invalid-input" }
  }
  if (request.inputs.length > 32 || request.inputs.reduce((size, input) => size + input.text.length, 0) > 1_000_000) {
    return { succeeded: false, status: "input-too-long" }
  }
  return null
}

export function prepareChunks(request: EmbeddingBatchRequest, policy: ChunkPolicy): PreparedChunks {
  const invalid = validateEmbeddingRequest(request)
  if (invalid) {
    return invalid
  }
  const output: PreparedChunk[] = []
  for (const [inputIndex, input] of request.inputs.entries()) {
    if (request.purpose === "query" && policy.measure(policy.prefix + input.text) > policy.maximum) {
      return { succeeded: false, status: "input-too-long" }
    }
    const chunks = chunkText(input.text, policy)
    if (!chunks || output.length + chunks.length > 256) {
      return { succeeded: false, status: "input-too-long" }
    }
    output.push(...chunks.map((text) => ({ inputIndex, text })))
  }
  return { succeeded: true, output }
}

export function chunkText(text: string, policy: ChunkPolicy): string[] | null {
  const characters = [...text]
  const chunks: string[] = []
  let start = 0
  while (start < characters.length) {
    const end = fittingEnd(characters, start, policy)
    if (end === start || chunks.length >= 256) {
      return null
    }
    chunks.push(policy.prefix + characters.slice(start, end).join(""))
    if (end === characters.length) {
      return chunks
    }
    start = overlapStart(characters, start, end, policy)
  }
  return chunks
}

function fittingEnd(characters: readonly string[], start: number, policy: ChunkPolicy): number {
  let low = start
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (policy.measure(policy.prefix + characters.slice(start, middle).join("")) <= policy.maximum) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return low
}

function overlapStart(characters: readonly string[], start: number, end: number, policy: ChunkPolicy): number {
  let low = start + 1
  let high = end
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (policy.measure(characters.slice(middle, end).join("")) > policy.overlap) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}
