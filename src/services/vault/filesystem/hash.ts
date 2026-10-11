import { createHash } from "node:crypto"

export function hashOf(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex")
}
