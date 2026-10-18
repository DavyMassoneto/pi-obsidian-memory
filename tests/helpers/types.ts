import type { ExtensionRegistrar } from "#src/pi"

export interface LimitsInput {
  maxBodyChars: number | string
  maxStatementChars: number
  maxTags?: number
}

export type RegistrarSetup = (registrar: ExtensionRegistrar) => void

export type DayWork = () => Promise<void>
