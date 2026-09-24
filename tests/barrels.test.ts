import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = join(import.meta.dirname, "..")

const IGNORED_FOLDERS = new Set(["node_modules", "tests"])

const ENTRY_POINTS = new Set(["run.ts"])

const REEXPORT = /^export \* from "(\.\/[^"]+)"$/

function codeFolders(dir: string): string[] {
  const folders = readdirSync(dir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !IGNORED_FOLDERS.has(entry.name),
  )
  return folders.flatMap((folder) => codeFoldersFrom(join(dir, folder.name)))
}

function codeFoldersFrom(path: string): string[] {
  const nested = codeFolders(path)
  if (hasOwnCode(path) || nested.length > 0) return [path, ...nested]
  return nested
}

function hasOwnCode(dir: string): boolean {
  return readdirSync(dir).some((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
}

function expectedReexports(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
    .map((entry) => entry.name)
    .filter((name) => name !== "index.ts" && !ENTRY_POINTS.has(name))
    .map((name) => `./${name}`)
  const folders = entries
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "index.ts")))
    .map((entry) => `./${entry.name}/index.ts`)
  return [...files, ...folders].sort()
}

function actualReexports(dir: string): string[] {
  const lines = readFileSync(join(dir, "index.ts"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
  return lines.map(reexportedPath).sort()
}

function reexportedPath(line: string): string {
  const path = REEXPORT.exec(line)?.[1]
  if (path === undefined) throw new Error(`linha que não é export * no index.ts: ${line}`)
  return path
}

describe("barrels", () => {
  const folders = codeFolders(ROOT).map((dir) => relative(ROOT, dir).replaceAll("\\", "/"))

  it("encontra as pastas de código", () => {
    expect(folders).toContain("scripts")
    expect(folders).toContain("scripts/release/plan")
  })

  it.each(folders)("%s tem index.ts", (folder) => {
    expect(existsSync(join(ROOT, folder, "index.ts"))).toBe(true)
  })

  it.each(folders)("%s/index.ts reexporta tudo da pasta, só com export *", (folder) => {
    expect(actualReexports(join(ROOT, folder))).toEqual(expectedReexports(join(ROOT, folder)))
  })
})
