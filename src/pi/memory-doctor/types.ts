import type { ChatModelSource, ModelAuthResult } from "#src/pi/context"
import type { BlankFile, VaultReport } from "#src/usecases"

export type CommandNames = () => string[]

export interface BlankTarget {
  vault: VaultReport["vault"]
  blank: BlankFile
}

export interface DoctorModelPort {
  find(provider: string, id: string): ChatModelSource | undefined
  configured(model: ChatModelSource): boolean
  auth(model: ChatModelSource): Promise<ModelAuthResult>
}
