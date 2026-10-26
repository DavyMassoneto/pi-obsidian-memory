import { Value } from "typebox/value"

import { DEFAULT_COMPACTION, DEFAULT_OBSERVER } from "./constants.ts"
import { ChatModelReferenceSchema, LegacyConfigSchema } from "./schemas.ts"
import type { MemoryConfig } from "./types.ts"

export function upgradeLegacyConfig(text: string): string {
  let document: object | null = null
  try {
    document = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return text
    throw error
  }
  if (!Value.Check(LegacyConfigSchema, document) || Value.Pointer.Has(document, "/observer")) return text
  const { capture: _capture, ...kept } = document
  const model = Value.Pointer.Get(document, "/capture/model")
  let observer: Partial<MemoryConfig["observer"]> = { ...DEFAULT_OBSERVER }
  if (Value.Check(ChatModelReferenceSchema, model)) observer = { model, ...DEFAULT_OBSERVER }
  return JSON.stringify({ compaction: DEFAULT_COMPACTION, ...kept, observer })
}
