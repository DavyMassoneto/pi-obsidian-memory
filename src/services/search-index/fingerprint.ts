import { createHash } from "node:crypto"

import type { MemoryConfig } from "#src/domain"
import { CATALOG_VALIDATION_POLICY } from "./constants.ts"

export function catalogValidationFingerprint(limits: MemoryConfig["limits"]): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        CATALOG_VALIDATION_POLICY,
        limits.maxStatementChars,
        limits.maxBodyChars,
        limits.maxNotesPerFolder,
      ]),
    )
    .digest("hex")
}
