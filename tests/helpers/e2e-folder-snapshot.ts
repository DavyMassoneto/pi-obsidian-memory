import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

export async function folderSnapshot(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true })
  const lines = await Promise.all(
    entries.map(async (entry) => {
      const { size, mtimeMs } = await stat(join(folder, entry))
      return `${entry}:${size}:${mtimeMs}`
    }),
  )
  return lines.sort()
}
