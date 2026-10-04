import { ulid } from "ulid"

export function newNoteId(): string {
  return ulid()
}
