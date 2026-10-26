import { CHARS_PER_TOKEN } from "#src/domain/observation-ledger"

function linePieces(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line]
  const pieces: string[] = []
  for (let start = 0; start < line.length; start += maxChars) pieces.push(line.slice(start, start + maxChars))
  return pieces
}

export function importParts(text: string, maxTokens: number): string[] {
  if (text.length === 0) return []
  const maxChars = maxTokens * CHARS_PER_TOKEN
  const parts: string[] = []
  let current: string[] = []
  let size = 0
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    for (const piece of linePieces(line, maxChars)) {
      if (current.length > 0 && size + 1 + piece.length > maxChars) {
        parts.push(current.join("\n"))
        current = []
        size = 0
      }
      size += current.length + piece.length
      current.push(piece)
    }
  }
  parts.push(current.join("\n"))
  return parts
}
