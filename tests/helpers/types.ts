import type { ExtensionRegistrar } from "#src/pi"
import type { CaptureAction, CaptureInput } from "#src/services"

export interface LimitsInput {
  maxBodyChars: number | string
  maxStatementChars: number
  maxTags?: number
}

export type RegistrarSetup = (registrar: ExtensionRegistrar) => void

export type StepFunction = (input: CaptureInput) => CaptureAction | Promise<CaptureAction>

export type ScriptStep = CaptureAction | StepFunction
export type Check = () => void | Promise<void>
