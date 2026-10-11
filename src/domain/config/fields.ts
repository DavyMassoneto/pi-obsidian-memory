import { Value } from "typebox/value"

import { ConfigLimitSchema, ConfigPathSchema, ProjectNameSchema } from "./schemas.ts"
import type { ConfigFields, ProjectEntry } from "./types.ts"

export function readConfigFields(text: string): ConfigFields {
  const fields: ConfigFields = { global: {}, projects: [], limits: {} }
  const document = JSON.parse(text)
  const vault = Value.Pointer.Get(document, "/global/vault")
  if (Value.Check(ConfigPathSchema, vault)) fields.global.vault = vault

  const body = Value.Pointer.Get(document, "/limits/maxBodyChars")
  if (Value.Check(ConfigLimitSchema, body)) fields.limits.maxBodyChars = body

  const statement = Value.Pointer.Get(document, "/limits/maxStatementChars")
  if (Value.Check(ConfigLimitSchema, statement)) fields.limits.maxStatementChars = statement

  const projects = Value.Pointer.Get(document, "/projects")
  if (!Array.isArray(projects)) return fields

  for (let index = 0; index < projects.length; index++) {
    const project: Partial<ProjectEntry> = {}
    const prefix = `/projects/${index}`
    const name = Value.Pointer.Get(document, `${prefix}/name`)
    if (Value.Check(ProjectNameSchema, name)) project.name = name

    const folder = Value.Pointer.Get(document, `${prefix}/folder`)
    if (Value.Check(ConfigPathSchema, folder)) project.folder = folder

    const vault = Value.Pointer.Get(document, `${prefix}/vault`)
    if (Value.Check(ConfigPathSchema, vault)) project.vault = vault

    fields.projects.push(project)
  }

  return fields
}
