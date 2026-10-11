import { readConfigInspection } from "./inspection.ts"
import { observedConfigFields } from "./observations.ts"
import type { ConfigFields } from "./types.ts"

export function readConfigFields(text: string): ConfigFields {
  return observedConfigFields(readConfigInspection(text))
}
