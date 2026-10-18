import { posix, win32 } from "node:path"

import { NAMED_FILE_UNDER_ROOT, NAMESPACE_PATH_START, POSIX_PROCESS_RELATIVE_PATH } from "./constants.ts"
import type { PathPlatform } from "./types.ts"

export function isRawDevicePath(path: string, cwd: string, platform: PathPlatform): boolean {
  if (platform !== "win32") return POSIX_PROCESS_RELATIVE_PATH.test(posix.resolve(cwd, path))
  const resolved = win32.resolve(cwd, path)
  return NAMESPACE_PATH_START.test(resolved) && !NAMED_FILE_UNDER_ROOT.test(resolved)
}
