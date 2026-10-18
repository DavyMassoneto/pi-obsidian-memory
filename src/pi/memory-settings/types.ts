import type { MemoryPiContext } from "#src/pi/context"
import type {
  ChatModelReference,
  MemoryConfig,
  RegistrationContext,
  SettingChange,
  SettingsPreparation,
} from "#src/usecases"

export interface CurrentModel {
  provider?: string
  id?: string
}

export interface ModelChoice {
  label: string
  reference: ChatModelReference
  current: boolean
}

export type VaultChanger = (context: RegistrationContext) => Promise<void>

export interface SettingsDeps {
  registration: RegistrationContext
  changeGlobalVault: VaultChanger
}

export interface SettingsEnv {
  ctx: MemoryPiContext
  deps: SettingsDeps
  context: RegistrationContext
  state: SettingsPreparation
}

export type LineEdit = (env: SettingsEnv) => Promise<void>

export interface SettingLine {
  label: string
  edit: LineEdit
}

export interface Saving {
  change: SettingChange
  what: string
  reload: boolean
}

export interface SwitchDiscriminant {
  kind: "captureSwitch"
}

export interface CountDiscriminant {
  kind: "captureCount"
}

export type CaptureCountName = Extract<SettingChange, CountDiscriminant>["name"]

export type CaptureSwitchName = Extract<SettingChange, SwitchDiscriminant>["name"]

export interface SwitchEditSpec {
  name: CaptureSwitchName
  what: string
  current: boolean
}

export interface EmbeddingChoice {
  value: MemoryConfig["embeddings"]
  label: string
}

export interface ModelEditSpec {
  title: string
  what: string
  kind: "captureModel" | "agentModel"
  current: CurrentModel
}

export type NumberChange = (value: number) => SettingChange

export interface NumberEditSpec {
  title: string
  what: string
  kind: "threshold" | "count"
  current: string
  change: NumberChange
  clear: SettingChange | null
}
