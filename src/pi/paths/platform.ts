import type { PathPlatform } from "#src/usecases"

export function hostPathPlatform(host: NodeJS.Platform): PathPlatform {
  if (host === "win32") return "win32"
  if (host === "darwin") return "darwin"
  return "linux"
}
