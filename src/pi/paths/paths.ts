import { join } from "node:path"

import { CONFIG_FILE_NAME, MEMORY_FOLDER_NAME } from "./constants.ts"

export function memoryConfigPath(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME, CONFIG_FILE_NAME)
}
