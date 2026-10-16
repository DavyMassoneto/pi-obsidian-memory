import type { ChatModelSource, ModelAuthResult } from "#src/pi/context"
import type { BlankFile, VaultReport } from "#src/usecases"

export interface BlankTarget {
  vault: VaultReport["vault"]
  blank: BlankFile
}

export interface DoctorModelPort {
  find(provider: string, id: string): ChatModelSource | undefined
  auth(model: ChatModelSource): Promise<ModelAuthResult>
}
