import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export const ULID_LINE = /^id: [0-9A-HJKMNP-TV-Z]{26}$/m

export interface VaultNote {
  path: string
  text: string
}

export function localToday(): string {
  return new Date().toLocaleDateString("sv-SE")
}

export async function writeVaultFile(vault: string, path: string, text: string): Promise<void> {
  const destination = join(vault, path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, text)
}

export function fileExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

export async function vaultNotes(vault: string): Promise<VaultNote[]> {
  const entries = await readdir(vault, { recursive: true })
  const paths = entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".md") && !path.endsWith("index.md") && !path.startsWith("_templates/"))
  return Promise.all(paths.map(async (path) => ({ path, text: await readFile(join(vault, path), "utf8") })))
}
