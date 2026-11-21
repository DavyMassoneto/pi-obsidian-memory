import { Value } from "typebox/value"

import { DEFAULT_COMPACTION, DEFAULT_CONSOLIDATOR, DEFAULT_OBSERVER } from "./constants.ts"
import { ChatModelReferenceSchema, ConfigObjectSchema, LegacyConfigSchema } from "./schemas.ts"
import type { MemoryConfig } from "./types.ts"

export function upgradeLegacyConfig(text: string): string {
  let document: object | null = null
  try {
    document = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return text
    throw error
  }
  if (!Value.Check(ConfigObjectSchema, document)) return text
  const withObserver = upgradeCapture(document)
  const upgraded = upgradeObserver(withObserver)
  if (upgraded === document) return text
  return JSON.stringify(upgraded)
}

function upgradeCapture(document: object): object {
  if (!Value.Check(LegacyConfigSchema, document) || Value.Pointer.Has(document, "/observer")) return document
  const { capture: _capture, ...kept } = document
  const model = Value.Pointer.Get(document, "/capture/model")
  let observer: Partial<MemoryConfig["observer"]> = { ...DEFAULT_OBSERVER }
  if (Value.Check(ChatModelReferenceSchema, model)) observer = { model, ...DEFAULT_OBSERVER }
  return { compaction: DEFAULT_COMPACTION, ...kept, observer }
}

function upgradeObserver(document: object): object {
  const observer = Value.Pointer.Get(document, "/observer")
  if (!Value.Check(ConfigObjectSchema, observer) || Value.Pointer.Has(document, "/consolidator")) return document
  const model = Value.Pointer.Get(observer, "/model")
  let consolidator: Partial<MemoryConfig["consolidator"]> = { ...DEFAULT_CONSOLIDATOR }
  if (Value.Check(ChatModelReferenceSchema, model)) consolidator = { model, ...DEFAULT_CONSOLIDATOR }
  return { ...document, consolidator }
}
