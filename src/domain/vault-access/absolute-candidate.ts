import { win32 } from "node:path"
import { fileURLToPath } from "node:url"

import {
  EXTENDED_LENGTH_PREFIX,
  EXTENDED_LENGTH_UNC_PREFIX,
  UNICODE_SPACES,
  WINDOWS_SHELL_DRIVE_PREFIX,
} from "./constants.ts"

export function absoluteCandidate(raw: string, cwd: string, home: string): string {
  const expanded = expandedPath(raw, home)
  const resolved = win32.resolve(cwd, expanded)
  return resolved.replace(EXTENDED_LENGTH_UNC_PREFIX, "\\\\").replace(EXTENDED_LENGTH_PREFIX, "")
}

function expandedPath(raw: string, home: string): string {
  const spaced = raw.replace(UNICODE_SPACES, " ")
  const native = windowsShellPath(withoutAtPrefix(spaced))

  if (native === "~") {
    return home
  }
  if (native.startsWith("~/") || native.startsWith("~\\")) {
    return win32.join(home, native.slice(2))
  }
  if (native.startsWith("file://")) {
    return fileURLToPath(native, { windows: true })
  }

  return native
}

function withoutAtPrefix(path: string): string {
  if (path.startsWith("@")) {
    return path.slice(1)
  }

  return path
}

function windowsShellPath(path: string): string {
  if (path.startsWith("//") || path.includes("\\")) {
    return path
  }

  return path.replace(WINDOWS_SHELL_DRIVE_PREFIX, (_prefix: string, drive: string) => `${drive.toUpperCase()}:/`)
}
