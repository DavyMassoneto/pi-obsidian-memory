import { basename } from "node:path"

import { type ProjectEntry, readConfigSnapshot, resolveProject } from "#src/services"
import type { MemoryContext } from "#src/usecases/add-memory"
import type { InitPreparation, InitPreparationResult, ProjectNameResult } from "./types.ts"

export async function prepareProjectInit(context: MemoryContext): Promise<InitPreparationResult> {
  const snapshot = await readConfigSnapshot({ path: context.configPath })
  if (!snapshot.succeeded) {
    return { succeeded: false, reason: "unreadable", configPath: context.configPath, problems: snapshot.problems }
  }
  if (snapshot.output.state === "missing") {
    return {
      succeeded: false,
      reason: "not-configured",
      configPath: context.configPath,
      problems: ["memory is not configured"],
    }
  }
  const parsed = snapshot.output.lexicalParse
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid-config", configPath: context.configPath, problems: parsed.problems }
  }
  const registered = resolveProject(parsed.output, context.workingFolder)
  let existing: ProjectEntry | null = null
  let defaultName = basename(context.workingFolder)
  if (registered.succeeded) {
    existing = registered.output
    defaultName = registered.output.name
  }
  const takenNames = parsed.output.projects.filter((project) => project !== existing).map((project) => project.name)
  return { succeeded: true, output: { expectedHash: snapshot.output.hash, existing, defaultName, takenNames } }
}

export function checkProjectName(preparation: InitPreparation, answer: string): ProjectNameResult {
  let name = answer.trim()
  if (name === "") name = preparation.defaultName
  const lowered = name.toLowerCase()
  if (preparation.takenNames.some((taken) => taken.toLowerCase() === lowered)) {
    return { succeeded: false, problems: [`a project named "${name}" is already registered`] }
  }
  return { succeeded: true, output: name }
}
