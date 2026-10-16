import { QUOTE_CHARACTERS, TOKEN_SEPARATOR } from "./constants.ts"

export function argumentTokens(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote = ""
  for (const character of command) {
    if (quote) {
      if (character === quote) quote = ""
      else current += character
    } else if (QUOTE_CHARACTERS.includes(character)) {
      quote = character
    } else if (TOKEN_SEPARATOR.test(character)) {
      if (current) tokens.push(current)
      current = ""
    } else {
      current += character
    }
  }
  if (current) tokens.push(current)
  return tokens
}
