import type { Static } from "typebox"

import type { Absent, Failed, Succeeded } from "#/domain/result"
import type { MemoryConfigSchema, ProjectEntrySchema } from "./schemas.ts"

export type MemoryConfig = Static<typeof MemoryConfigSchema>

export type ProjectEntry = Static<typeof ProjectEntrySchema>

export type ParseConfigResult = Succeeded<MemoryConfig> | Failed

export type ResolveProjectResult = Succeeded<ProjectEntry> | Absent
