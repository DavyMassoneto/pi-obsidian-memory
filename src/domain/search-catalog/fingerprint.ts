import { createHash } from "node:crypto"

import type { SemanticContent } from "./types.ts"

export function semanticFingerprint(content: SemanticContent): string {
  return createHash("sha256")
    .update(JSON.stringify([content.statement, content.body]))
    .digest("hex")
}
