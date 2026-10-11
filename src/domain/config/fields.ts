import { Value } from "typebox/value"

import { ConfigLimitSchema, ConfigPathSchema, ProjectNameSchema } from "./schemas.ts"
import type { ConfigFields, ProjectEntry } from "./types.ts"

export function readConfigFields(text: string): ConfigFields {
  const fields: ConfigFields = { global: {}, projects: [], limits: {} }
  const vault = Value.Pointer.Get(JSON.parse(text), "/global/vault")
  if (Value.Check(ConfigPathSchema, vault)) {
    fields.global.vault = vault
  }
  const body = Value.Pointer.Get(JSON.parse(text), "/limits/maxBodyChars")
  if (Value.Check(ConfigLimitSchema, body)) {
    fields.limits.maxBodyChars = body
  }
  const statement = Value.Pointer.Get(JSON.parse(text), "/limits/maxStatementChars")
  if (Value.Check(ConfigLimitSchema, statement)) {
    fields.limits.maxStatementChars = statement
  }
  const projects = Value.Pointer.Get(JSON.parse(text), "/projects")
  if (Array.isArray(projects)) {
    for (let index = 0; index < projects.length; index++) {
      fields.projects.push(readProjectFields(text, index))
    }
  }
  return fields
}

function readProjectFields(text: string, index: number): Partial<ProjectEntry> {
  const project: Partial<ProjectEntry> = {}
  const prefix = `/projects/${index}`
  const name = Value.Pointer.Get(JSON.parse(text), `${prefix}/name`)
  if (Value.Check(ProjectNameSchema, name)) {
    project.name = name
  }
  const folder = Value.Pointer.Get(JSON.parse(text), `${prefix}/folder`)
  if (Value.Check(ConfigPathSchema, folder)) {
    project.folder = folder
  }
  const vault = Value.Pointer.Get(JSON.parse(text), `${prefix}/vault`)
  if (Value.Check(ConfigPathSchema, vault)) {
    project.vault = vault
  }
  return project
}
