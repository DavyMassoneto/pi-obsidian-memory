import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import { assessConfig } from "#/domain"
import type { ConfigLocation, ReadConfigSnapshotResult } from "./types.ts"

export async function readConfigSnapshot(request: ConfigLocation): Promise<ReadConfigSnapshotResult> {
  try {
    const bytes = await readFile(request.path)
    const text = bytes.toString("utf8")
    return {
      succeeded: true,
      output: {
        state: "present",
        hash: createHash("sha256").update(bytes).digest("hex"),
        text,
        ...assessConfig(text),
      },
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { succeeded: true, output: { state: "missing", hash: null } }
    }
    return { succeeded: false, problems: [`${request.path}: ${String(error)}`] }
  }
}
