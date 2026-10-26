import type { MapVault } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export type LoadMemoryMapResult = Succeeded<MapVault[]> | MemoryResolutionRefusal
