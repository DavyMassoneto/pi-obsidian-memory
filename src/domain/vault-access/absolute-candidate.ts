import { win32 } from "node:path"
import { fileURLToPath } from "node:url"

import {
  DRIVE_OR_UNC_START,
  LOCAL_ADMIN_SHARE,
  NAMESPACE_PREFIX,
  NAMESPACE_UNC_PREFIX,
  UNICODE_SPACES,
  WINDOWS_SHELL_DRIVE_PREFIX,
} from "./constants.ts"

export function absoluteCandidate(raw: string, cwd: string, home: string): string {
  const expanded = expandedPath(raw, home)
  const resolved = win32.resolve(cwd, expanded)
  const stripped = resolved.replace(NAMESPACE_UNC_PREFIX, "\\\\").replace(NAMESPACE_PREFIX, "")
  if (!DRIVE_OR_UNC_START.test(stripped)) {
    return resolved
  }

  return stripped.replace(LOCAL_ADMIN_SHARE, (_share: string, drive: string) => `${drive.toUpperCase()}:\\`)
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
