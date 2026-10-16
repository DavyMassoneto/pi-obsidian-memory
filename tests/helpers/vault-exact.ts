import { createHash } from "node:crypto"
import { join } from "node:path"

import { renderNote } from "#src/domain"
import { aNote } from "./note.ts"
import { catalogVault, putCatalogFile } from "./vault-catalog.ts"

export async function vaultWithStoredFile(extension: string) {
  const vault = { ...(await catalogVault()), name: "Memory" }
  const note = { ...aNote(), statement: "Exact statement" }
  const folder = "Subject"
  const path = `${folder}/${note.statement}${extension}`
  const text = renderNote(note)
  await putCatalogFile(vault, path, text)
  const hash = createHash("sha256").update(text).digest("hex")
  return { vault, note, folder, path, file: join(vault.path, path), text, hash }
}
