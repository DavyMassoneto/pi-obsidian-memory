import { chmod } from "node:fs/promises"
import { dirname } from "node:path"

export async function blockWrite(file: string) {
  if (process.platform === "win32") {
    await chmod(file, 0o444)
    return () => chmod(file, 0o666)
  }
  const folder = dirname(file)
  await chmod(folder, 0o555)
  return () => chmod(folder, 0o755)
}
