import { readFile } from "node:fs/promises"

import { parseConfig } from "#/domain"
import type { ReadConfigResult } from "./types.ts"

export async function readConfig(path: string): Promise<ReadConfigResult> {
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        succeeded: false,
        reason: "not-configured",
        configPath: path,
        problems: ["memory is not configured"],
      }
    }

    throw error
  }

  const parsed = parseConfig(text)
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid-config", configPath: path, problems: parsed.problems }
  }

  return parsed
}
