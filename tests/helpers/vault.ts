import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, parse } from "node:path"

import { renderNote } from "#/domain"
import type { RefreshContinuation } from "#/services"
import { aDecision, aNote, aQuestion } from "./note.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function linkFolder(target: string, link: string): Promise<void> {
  await symlink(target, link, "junction")
}

export async function tryLinkFile(target: string, link: string): Promise<boolean> {
  try {
    await symlink(target, link, "file")
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      return false
    }

    throw error
  }
}

export function otherDriveRoots(): string[] {
  const tempDrive = parse(tmpdir()).root.toUpperCase()
  const letters = [..."CDEFGHIJKLMNOPQRSTUVWXYZ"]

  return letters.map((letter) => `${letter}:\\`).filter((root) => root !== tempDrive && existsSync(root))
}

export async function putNoteFile(vault: string, folder: string, statement: string, text: string): Promise<void> {
  await mkdir(join(vault, folder), { recursive: true })
  await writeFile(join(vault, folder, `${statement}.md`), text)
}

export async function readIndexOf(vault: string, folder: string): Promise<string> {
  return readFile(join(vault, folder, "index.md"), "utf8")
}

export async function vaultWithNote() {
  const vault = await useTempFolder()
  const note = aNote()
  const text = renderNote(note)
  await putNoteFile(vault, "pnpm", note.statement, text)
  const hash = createHash("sha256").update(text).digest("hex")
  return { vault, note, file: join(vault, "pnpm", `${note.statement}.md`), hash }
}

export async function vaultWithNoteToArchive(today: string) {
  const stored = await vaultWithNote()
  const request = { note: { folder: "pnpm", note: stored.note }, hashWhenRead: stored.hash, today }

  return { ...stored, request }
}

export async function vaultWithQuestion(today: string) {
  const vault = await useTempFolder()
  const question = aQuestion()
  const text = renderNote(question)
  await putNoteFile(vault, "search", question.statement, text)
  const hash = createHash("sha256").update(text).digest("hex")

  const request = {
    previous: { folder: "search", note: question },
    hashWhenRead: hash,
    successor: { folder: "search", note: aDecision() },
    today,
  }
  return { vault, request, file: join(vault, "search", `${question.statement}.md`) }
}

export function keepGoing(): boolean {
  return true
}

export async function nestedAliasVault(): Promise<string> {
  const vault = await useTempFolder()
  await mkdir(join(vault, "physical", "subject"), { recursive: true })
  await mkdir(join(vault, "other", "deep"), { recursive: true })
  await linkFolder(join(vault, "physical", "subject"), join(vault, "alias"))
  await linkFolder(join(vault, "other", "deep"), join(vault, "physical", "subject", "child"))
  await writeFile(join(vault, "other", "deep", `${aNote().statement}.md`), renderNote(aNote()))
  return vault
}

export function allowing(checks: number): RefreshContinuation {
  let left = checks
  return () => {
    left -= 1
    return left >= 0
  }
}
