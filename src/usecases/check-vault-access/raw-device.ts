import { win32 } from "node:path"

import { NAMED_FILE_UNDER_ROOT, NAMESPACE_PATH_START } from "./constants.ts"

export function isRawDevicePath(path: string, cwd: string): boolean {
  const resolved = win32.resolve(cwd, path)
  return NAMESPACE_PATH_START.test(resolved) && !NAMED_FILE_UNDER_ROOT.test(resolved)
}
