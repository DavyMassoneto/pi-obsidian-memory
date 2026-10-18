import type { PathPlatform } from "#src/domain/path-platform"
import { parseConfig } from "./parse.ts"
import { resolveProject } from "./paths.ts"
import type { InitProposal, ParseConfigResult, SetupProposal } from "./types.ts"

export function proposeSetup(request: SetupProposal, platform: PathPlatform): ParseConfigResult {
  const config = {
    global: { vault: request.vault },
    projects: request.config.projects,
    limits: request.config.limits,
    capture: request.config.capture,
    memoryAgent: request.config.memoryAgent,
    context: request.config.context,
    embeddings: request.config.embeddings,
    decisionModel: request.config.decisionModel,
  }
  return parseConfig(JSON.stringify(config), platform)
}

export function proposeInit(request: InitProposal, platform: PathPlatform): ParseConfigResult {
  const existing = resolveProject(request.config, request.folder, platform)
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
  return parseConfig(JSON.stringify({ ...request.config, projects }), platform)
}
