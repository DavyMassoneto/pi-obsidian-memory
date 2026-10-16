import { join } from "node:path"

import { CONFIG_FILE_NAME, INDEX_FOLDER_NAME, MEMORY_FOLDER_NAME, MODEL_FOLDER_NAME } from "./constants.ts"

export function memoryConfigPath(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME, CONFIG_FILE_NAME)
}

export function memoryDataFolder(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME)
}

export function memoryModelCachePath(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME, MODEL_FOLDER_NAME)
}

export function memoryIndexPath(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME, INDEX_FOLDER_NAME)
}
