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

export interface WhenChoice {
  value: MemoryConfig["capture"]["when"]
  label: string
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
