import { parseConfig } from "./parse.ts"
import { resolveProject } from "./paths.ts"
import type { InitProposal, ParseConfigResult, SetupProposal } from "./types.ts"

export function proposeSetup(request: SetupProposal): ParseConfigResult {
  const config = {
    global: { vault: request.vault },
    projects: request.config.projects,
    limits: request.config.limits,
  }
  return parseConfig(JSON.stringify(config))
}

export function proposeInit(request: InitProposal): ParseConfigResult {
  const existing = resolveProject(request.config, request.folder)
  let folder = request.folder
  if (existing.succeeded) {
    folder = existing.output.folder
  }
  const replacement = { name: request.name, folder, vault: request.vault }
  const projects = [...request.config.projects]
  if (existing.succeeded) {
    projects.splice(projects.indexOf(existing.output), 1, replacement)
  } else {
    projects.push(replacement)
  }
  return parseConfig(JSON.stringify({ ...request.config, projects }))
}
