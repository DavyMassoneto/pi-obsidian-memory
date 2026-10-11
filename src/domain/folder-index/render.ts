import type { Note } from "#/domain/note"
import { ARCHIVE_FOLDER, checkVaultPath, FOLDER_INDEX_NAME, joinVaultPath } from "#/domain/vault-path"
import { DONT_FORGET_LABEL, INDEX_TEXT_COLLATOR, NOTE_LINE_SEPARATOR, PROBLEM_SEPARATOR } from "./constants.ts"
import { displayIndexName, displayIndexText } from "./display.ts"
import type { FolderContents, InvalidNote, Titled } from "./types.ts"

export function renderFolderIndex(folder: FolderContents): string {
  const path = linkPathOf(folder)

  const subjects = sortAlphabetically(folder.subjects).map((subject) => subjectLine(path, subject))
  const notes = [...folder.notes].sort(byStatement).map((note) => noteLine(path, note))
  const invalid = [...folder.invalid].sort(byStatement).map((note) => invalidLine(path, note))

  const blocks = [
    `# ${displayIndexText(titleOf(folder))}`,
    ...section("Subjects", subjects),
    ...section("Notes", notes),
    ...section("Needs fixing", [...invalid, ...problemFolderLines(folder)]),
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
  const target = joinVaultPath(path, subject, FOLDER_INDEX_NAME)
  const problems = checkVaultPath(target)
  if (problems.length > 0) {
    return `- ${displayIndexName(subject)}${NOTE_LINE_SEPARATOR}${problems.map(displayIndexName).join(PROBLEM_SEPARATOR)}`
  }

  return `- [[${target}|${subject}]]`
}

function noteLine(path: string, note: Note): string {
  const parts = [noteLink(path, note.statement), note.frontmatter.type]

  if (note.frontmatter.dontForget) {
    parts.push(DONT_FORGET_LABEL)
  }

  return `- ${parts.join(NOTE_LINE_SEPARATOR)}`
}

function invalidLine(path: string, note: InvalidNote): string {
  const parts = [noteLink(path, note.statement), note.problems.map(displayIndexText).join(PROBLEM_SEPARATOR)]
  return `- ${parts.join(NOTE_LINE_SEPARATOR)}`
}

function noteLink(path: string, statement: string): string {
  const target = joinVaultPath(path, statement)
  if (statement.length === 0 || checkVaultPath(target).length > 0) {
    return displayIndexName(statement)
  }

  return `[[${target}|${statement}]]`
}

function problemFolderLines(folder: FolderContents): string[] {
  if (!folder.problemFolders) {
    return []
  }

  return [...folder.problemFolders]
    .sort((first, second) => compareText(first.folder, second.folder))
    .map(
      (problem) =>
        `- Folder ${displayIndexName(problem.folder)}${NOTE_LINE_SEPARATOR}${problem.problems.map(displayIndexText).join(PROBLEM_SEPARATOR)}`,
    )
}

function sortAlphabetically(values: string[]): string[] {
  return [...values].sort(compareText)
}

function byStatement(first: Titled, second: Titled): number {
  return compareText(first.statement, second.statement)
}

function compareText(first: string, second: string): number {
  return INDEX_TEXT_COLLATOR.compare(first, second)
}
