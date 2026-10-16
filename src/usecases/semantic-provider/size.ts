import { localModelAssets } from "#src/services"
import { BYTES_PER_MEGABYTE } from "./constants.ts"

export function localModelDownloadBytes(): number {
  return localModelAssets.reduce((sum, asset) => sum + asset.bytes, 0)
}

export function localModelDownloadMegabytes(): number {
  return Math.round(localModelDownloadBytes() / BYTES_PER_MEGABYTE)
}
