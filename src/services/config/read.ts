import { readFile } from "node:fs/promises"

import type { PathPlatform } from "#src/domain"
import { parseConfig } from "#src/domain"
import { canonicalizeConfigLocation } from "./canonicalize.ts"
import type { ReadConfigResult } from "./types.ts"

export async function readConfig(path: string, platform: PathPlatform): Promise<ReadConfigResult> {
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

    let code = "UNKNOWN"
    if (error instanceof Error && "code" in error && typeof error.code === "string") {
      code = error.code
    }

    return {
      succeeded: false,
      reason: "unreadable",
      configPath: path,
      code,
      problems: [`${path}: cannot read config (${code})`],
    }
  }

  const parsed = parseConfig(text, platform)
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid-config", configPath: path, problems: parsed.problems }
  }

  const canonical = await canonicalizeConfigLocation({ config: parsed.output, configPath: path, platform })
  if (!canonical.succeeded) {
    return { succeeded: false, reason: "invalid-config", configPath: path, problems: canonical.problems }
  }

  return parsed
}
