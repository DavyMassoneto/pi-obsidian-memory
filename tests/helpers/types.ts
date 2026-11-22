import type { ExtensionRegistrar } from "#src/pi"

export interface LimitsInput {
  maxBodyChars: number | string
  maxStatementChars: number
  maxTags?: number
}

export type RegistrarSetup = (registrar: ExtensionRegistrar) => void

export type DayWork = () => Promise<void>

export interface UnreadableObservation {
  id: string
  content?: string
  tokens?: number
  origin?: string
}

export interface UnreadableEntryData {
  recordId?: string
  entryId?: string
  journey?: string
  vault?: string
  fromId?: string
  coversUpToId?: string
  userEntryIds?: string[]
  observations?: UnreadableObservation[]
}
