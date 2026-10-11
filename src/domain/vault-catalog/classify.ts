import type { VaultEntryKind } from "./types.ts"

export function isRootArchive(path: string): boolean {
  return path.split("/")[0]?.toLowerCase() === "archive"
}

export function isRootTemplate(path: string): boolean {
  return path.split("/")[0]?.toLowerCase() === "_templates"
}

export function isCatalogHidden(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("."))
}

export function catalogFileKind(path: string): Exclude<VaultEntryKind, "folder"> {
  const lower = path.toLowerCase()
  const name = lower.split("/").at(-1)
  if (/\.md\.tmp-[^/]+$/i.test(path)) return "temporary"
  if (isRootTemplate(path)) return "template"
  if (name === "index.md") return "index"
  if (lower === "memory.base") return "dashboard"
  if (lower.endsWith(".md")) return "note"
  return "other"
}

export function isSafeCatalogPath(path: string): boolean {
  return path.length > 0 && path.split("/").every(isSafeCatalogPart)
}

function isSafeCatalogPart(part: string): boolean {
  return part.length > 0 && part !== "." && part !== ".." && !/[\\:]/.test(part) && !part.includes("\u0000")
}
