import { displayNotePath } from "./paths.ts"
import type { VaultResult } from "./types.ts"

export function refuseNotWritable(folder: string, statement: string, code: string): VaultResult {
  const problem = `${displayNotePath(folder, statement)} cannot be written (${code})`
  return { succeeded: false, reason: "not-writable", problems: [problem] }
}
