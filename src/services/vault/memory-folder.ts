import { relative, sep } from "node:path"

import { checkMemoryFolder } from "#/domain"
import { resolveFolder } from "./resolve.ts"
import type { ResolveResult } from "./types.ts"

export async function resolveMemoryFolder(vault: string, folder: string): Promise<ResolveResult> {
  const directory = await resolveFolder(vault, folder)
  if (!directory.succeeded) return directory
  const root = await resolveFolder(vault, "")
  if (!root.succeeded) return root
  const actualFolder = relative(root.output, directory.output).split(sep).join("/")
  const problems = checkMemoryFolder(actualFolder)
  if (problems.length > 0) return { succeeded: false, reason: "invalid", problems }
  return directory
}
