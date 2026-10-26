import { CHARS_PER_TOKEN } from "./constants.ts"

export function textTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
