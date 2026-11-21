import { Value } from "typebox/value"

import { LEGACY_CAPTURE_CADENCE } from "./constants.ts"
import { LegacyCaptureSchema } from "./schemas.ts"

export function upgradeLegacyCapture(text: string): string {
  let document: object | null = null
  try {
    document = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return text
    throw error
  }
  if (!Value.Check(LegacyCaptureSchema, document)) return text
  const { when, ...kept } = document.capture
  return JSON.stringify({ ...document, capture: { ...LEGACY_CAPTURE_CADENCE[when], ...kept } })
}
