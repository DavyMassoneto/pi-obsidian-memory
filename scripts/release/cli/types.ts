import type { Static } from "typebox"

import type { BumpSchema, CliOptionsSchema } from "./schemas.ts"

export type Bump = Static<typeof BumpSchema>

export type CliOptions = Static<typeof CliOptionsSchema>
