import { createHash } from "node:crypto"
import { join } from "node:path"

import { comparablePath, type PathPlatform } from "#src/domain"
import { INDEX_FILE_EXTENSION, INDEX_FILE_NAME_LENGTH } from "./constants.ts"

export function indexFileFor(indexFolder: string, vaultPath: string, platform: PathPlatform): string {
  const vaultKey = comparablePath(vaultPath, platform)
  const name = createHash("sha256").update(vaultKey).digest("hex").slice(0, INDEX_FILE_NAME_LENGTH)

  return join(indexFolder, `${name}${INDEX_FILE_EXTENSION}`)
}
