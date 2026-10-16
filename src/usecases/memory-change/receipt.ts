import type { Note } from "#src/services"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { DeliveredRead, MemoryAddress } from "#src/usecases/session"
import type { ReceiptRefusal, ReceiptResult } from "./types.ts"

export function receiptedNote(
  context: MemoryOperationContext,
  address: MemoryAddress,
  canonicalVault: string,
): ReceiptResult {
  const read = context.session.getReceipt(context.stamp, address)
  if (!read) {
    return refuse("not-read", `${address.path} was not read with memory_get in this session`)
  }
  if (read.canonicalVault !== canonicalVault) {
    return refuse("stale-vault", `the vault registered for ${address.vault} changed since ${address.path} was read`)
  }
  if (read.archived) {
    return refuse("archived", `${address.path} is archived and archived notes are not changed`)
  }
  const note = noteOf(read)
  if (!note) {
    return refuse("needs-fixing", `${address.path} has no valid frontmatter`)
  }
  return { succeeded: true, output: { read, note, folder: folderOf(read.path) } }
}

function noteOf(read: DeliveredRead): Note | null {
  const { analysis } = read
  if (!analysis.frontmatter) return null
  return { statement: analysis.parsed.statement, frontmatter: analysis.frontmatter, body: analysis.parsed.body }
}

function folderOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf("/")))
}

function refuse(reason: ReceiptRefusal["reason"], problem: string): ReceiptRefusal {
  return { succeeded: false, reason, problems: [problem] }
}
