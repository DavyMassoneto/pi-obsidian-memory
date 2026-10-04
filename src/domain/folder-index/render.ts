import { FOLDER_INDEX_NAME, type Note } from "#/domain/note"
import { ARCHIVE_FOLDER, DONT_FORGET_LABEL, NOTE_LINE_SEPARATOR } from "./constants.ts"
import type { FolderContents } from "./types.ts"

export function renderFolderIndex(folder: FolderContents): string {
  const path = linkPathOf(folder)

  const subjects = sortAlphabetically(folder.subjects).map((subject) => subjectLine(path, subject))
  const notes = [...folder.notes].sort(byStatement).map((note) => noteLine(path, note))

  const blocks = [
    `# ${titleOf(folder)}`,
    ...section("Subjects", subjects),
    ...section("Notes", notes),
    ...archiveSection(folder),
  ]

  return `${blocks.join("\n\n")}\n`
}

function titleOf(folder: FolderContents): string {
  if (folder.kind === "root") {
    return folder.vaultName
  }

  return folder.path
}

function linkPathOf(folder: FolderContents): string {
  if (folder.kind === "root") {
    return ""
  }

  return folder.path
}

function section(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return []
  }

  return [`## ${title}`, lines.join("\n")]
}

function archiveSection(folder: FolderContents): string[] {
  if (folder.kind === "root" && folder.hasArchive) {
    return section("Archive", [subjectLine("", ARCHIVE_FOLDER)])
  }

  return []
}

function subjectLine(path: string, subject: string): string {
  const target = joinPath(joinPath(path, subject), FOLDER_INDEX_NAME)
  return `- [[${target}|${subject}]]`
}

function noteLine(path: string, note: Note): string {
  const link = `[[${joinPath(path, note.statement)}|${note.statement}]]`
  const parts = [link, note.frontmatter.type]

  if (note.frontmatter.dontForget) {
    parts.push(DONT_FORGET_LABEL)
  }

  return `- ${parts.join(NOTE_LINE_SEPARATOR)}`
}

function joinPath(path: string, name: string): string {
  if (path.length === 0) {
    return name
  }

  return `${path}/${name}`
}

function sortAlphabetically(values: string[]): string[] {
  return [...values].sort(compareText)
}

function byStatement(first: Note, second: Note): number {
  return compareText(first.statement, second.statement)
}

function compareText(first: string, second: string): number {
  return new Intl.Collator("en", { sensitivity: "base" }).compare(first, second)
}
