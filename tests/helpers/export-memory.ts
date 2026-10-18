import { execFile } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"

import { piMemoryFixture } from "./pi-memory.ts"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

const SYSTEM_ROOT = process.env.SystemRoot

export async function exportFixture() {
  const fixture = await searchFixture()
  const { vault, project } = fixture
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await putCatalogFile(vault, "archive/tools/Old.md", noteWithId(2, "Old.", ["archived: 2026-10-01"]))
  await putCatalogFile(vault, "_templates/rule.md", "---\ntype: rule\n---\n")
  await putCatalogFile(vault, "Memory.base", "views: []\n")
  await putCatalogFile(vault, "index.md", "# Global\n")
  await putCatalogFile(vault, "Ação é.md", noteWithId(5, "Accents.", []))
  await putCatalogFile(vault, "attachments/diagram.png", new Uint8Array([137, 80, 78, 71, 0, 255, 1]))
  await putCatalogFile(vault, ".obsidian/app.json", "{}")
  await putCatalogFile(vault, "tools/Half.md.tmp-abc", "partial")
  await putCatalogFile(project, "Deploy.md", noteWithId(3, "Deploy on Friday.", []))
  const destination = join(fixture.root, "exports")
  await mkdir(destination)
  return { ...fixture, destination }
}

export async function unzipArchive(archive: string, into: string): Promise<void> {
  await mkdir(into, { recursive: true })
  if (process.platform !== "win32") {
    const extraction = promisify(execFile)("python3", ["-m", "zipfile", "-e", archive, into])
    extraction.child.stdin?.end()
    await extraction
    return
  }
  if (typeof SYSTEM_ROOT !== "string") throw new Error("SystemRoot is required to find tar.exe")
  await promisify(execFile)(join(SYSTEM_ROOT, "System32", "tar.exe"), ["-xf", archive, "-C", into])
}

export function isExported(line: string): boolean {
  return !line.startsWith(".obsidian") && !line.includes(".tmp-")
}

export async function exportablePiFixture() {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const out = join(fixture.root, "exports")
  await mkdir(out)
  return { ...fixture, out }
}
