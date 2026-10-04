import { parseConfig } from "#/domain/config"
import { readRawFile } from "#/services/vault"
import { NOT_CONFIGURED_PROBLEM } from "./constants.ts"
import type { ReadConfigResult } from "./types.ts"

export async function readConfig(path: string): Promise<ReadConfigResult> {
  const file = await readRawFile(path)
  if (!file.succeeded) {
    return { succeeded: false, reason: "not-configured", problems: [NOT_CONFIGURED_PROBLEM] }
  }

  const parsed = parseConfig(file.output.toString("utf8"))
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid", problems: parsed.problems }
  }

  return parsed
}
