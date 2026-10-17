import type { ProjectEntry } from "#src/usecases"
import {
  NO_PROJECTS_NOTICE,
  PROJECT_ACTION_TITLE,
  PROJECT_CHANGE_VAULT,
  PROJECT_REMOVE,
  PROJECT_TITLE,
  PROJECT_VAULT_TITLE,
} from "./constants.ts"
import { saveChange } from "./save.ts"
import type { SettingsEnv } from "./types.ts"

export function projectLabel(project: ProjectEntry): string {
  return `${project.name} — ${project.folder} → ${project.vault}`
}

async function repoint(env: SettingsEnv, project: ProjectEntry): Promise<void> {
  const answer = await env.ctx.ui.input(PROJECT_VAULT_TITLE, project.vault)
  if (typeof answer !== "string" || answer.trim() === "") return
  await saveChange(env, {
    change: { kind: "projectVault", name: project.name, vault: answer.trim() },
    what: `project ${project.name} now uses ${answer.trim()}`,
    reload: true,
  })
}

async function remove(env: SettingsEnv, project: ProjectEntry): Promise<void> {
  await saveChange(env, {
    change: { kind: "removeProject", name: project.name },
    what: `project ${project.name} was removed from the memory`,
    reload: true,
  })
}

export async function projectsEdit(env: SettingsEnv): Promise<void> {
  const { projects } = env.state.config
  if (projects.length === 0) return env.ctx.ui.notify(NO_PROJECTS_NOTICE, "info")
  const labels = projects.map(projectLabel)
  const answer = await env.ctx.ui.select(PROJECT_TITLE, labels)
  const project = projects.find((_entry, index) => labels[index] === answer)
  if (!project) return
  const actions = [PROJECT_CHANGE_VAULT, PROJECT_REMOVE]
  const action = await env.ctx.ui.select(PROJECT_ACTION_TITLE, actions)
  if (action === PROJECT_CHANGE_VAULT) return repoint(env, project)
  if (action === PROJECT_REMOVE) return remove(env, project)
}
