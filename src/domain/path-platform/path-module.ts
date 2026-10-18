import { posix, win32 } from "node:path"

import type { PathPlatform } from "./types.ts"

export function pathModule(platform: PathPlatform): typeof posix {
  if (platform === "win32") {
    return win32
  }

  return posix
}
