import type { NoteLimits } from "#src/domain"

export function aLimits(): NoteLimits {
  return { maxBodyChars: 1000, maxStatementChars: 100 }
}
