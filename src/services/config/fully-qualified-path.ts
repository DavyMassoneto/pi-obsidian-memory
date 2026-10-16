import { isAbsolute, parse, sep } from "node:path"

export function isFullyQualifiedPath(path: string): boolean {
  if (!isAbsolute(path)) {
    return false
  }

  const root = parse(path).root.replaceAll("\\", "/")
  if (sep === "\\" && !root.includes(":") && !root.startsWith("//")) {
    return false
  }

  return true
}
