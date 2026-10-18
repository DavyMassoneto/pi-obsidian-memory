import { hostPathPlatform } from "#src/pi"
import type { PathPlatform } from "#src/usecases"

export function testPlatform(): PathPlatform {
  return hostPathPlatform(process.platform)
}
