import { ARCHIVE_FOLDER, joinVaultPath } from "#/domain/note"
import type { PlacedNote, Succession } from "./types.ts"

export function archiveNote(placed: PlacedNote, today: string): PlacedNote {
  const { note } = placed

  return {
    folder: joinVaultPath(ARCHIVE_FOLDER, placed.folder),
    note: { ...note, frontmatter: { ...note.frontmatter, archived: today } },
  }
}

export function succeedNote(previous: PlacedNote, successor: PlacedNote, today: string): Succession {
  const archived = archiveNote(previous, today)
  const born = { ...successor.note.frontmatter, created: today, updated: today }

  return {
    archived: {
      folder: archived.folder,
      note: { ...archived.note, frontmatter: { ...archived.note.frontmatter, replacedBy: linkTo(successor) } },
    },
    successor: {
      folder: successor.folder,
      note: { ...successor.note, frontmatter: { ...born, replaces: linkTo(archived) } },
    },
  }
}

function linkTo(placed: PlacedNote): string {
  return `[[${joinVaultPath(placed.folder, placed.note.statement)}]]`
}
