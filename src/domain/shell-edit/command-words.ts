import { QUOTE_CHARACTERS } from "#src/domain/vault-access"

export function commandWords(segment: string): string[] {
  const words: string[] = []
  let current = ""
  let quote = ""
  for (const character of segment) {
    if (quote) {
      if (character === quote) quote = ""
      else current += character
    } else if (QUOTE_CHARACTERS.includes(character)) {
      quote = character
    } else if (/\s/.test(character)) {
      if (current) words.push(current)
      current = ""
    } else {
      current += character
    }
  }
  if (current) words.push(current)
  return words
}
