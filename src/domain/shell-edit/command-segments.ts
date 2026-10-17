import { QUOTE_CHARACTERS } from "#src/domain/vault-access"

export function commandSegments(command: string): string[] {
  const segments: string[] = []
  let current = ""
  let quote = ""
  for (const character of command) {
    if (quote) {
      if (character === quote) quote = ""
      current += character
    } else if (QUOTE_CHARACTERS.includes(character)) {
      quote = character
      current += character
    } else if (endsSegment(character, current)) {
      segments.push(current)
      current = ""
    } else if (character !== "&" || current.trim() !== "") {
      current += character
    }
  }
  segments.push(current)
  return segments.filter((segment) => segment.trim() !== "")
}

function endsSegment(character: string, current: string): boolean {
  if (character === ";" || character === "|" || character === "\n") return true
  return character === "&" && current.trim() !== ""
}
