import type { PathPlatform } from "#src/usecases"

export function testPlatform(): PathPlatform {
  if (process.platform === "win32") return "win32"
  if (process.platform === "darwin") return "darwin"
  return "linux"
}
