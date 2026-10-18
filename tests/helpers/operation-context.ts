import { dirname, join } from "node:path"

import { createMemorySession, type MemoryOperationContext } from "#src/usecases"
import { sessionIdentity } from "./session.ts"
import { testPlatform } from "./test-platform.ts"

export interface OperationPaths {
  configPath: string
  workingFolder: string
}

export function operationContextFor(paths: OperationPaths): MemoryOperationContext {
  const session = createMemorySession(sessionIdentity())
  return {
    configPath: paths.configPath,
    workingFolder: paths.workingFolder,
    indexPath: join(dirname(paths.configPath), "index"),
    platform: testPlatform(),
    session,
    stamp: session.stamp(),
    signal: session.signal(session.stamp()),
  }
}
