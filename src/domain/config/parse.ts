import { Value } from "typebox/value"

import { describeSchemaErrors } from "#/domain/validation"
import { readConfigFields } from "./fields.ts"
import { registrationProblems } from "./invariants.ts"
import { MemoryConfigSchema } from "./schemas.ts"
import type { ParseConfigResult } from "./types.ts"

export function parseConfig(text: string): ParseConfigResult {
  try {
    const config = JSON.parse(text)
    if (!Value.Check(MemoryConfigSchema, config)) {
      const errors = describeSchemaErrors(Value.Errors(MemoryConfigSchema, config), "config")
      return { succeeded: false, problems: [...errors, ...registrationProblems(readConfigFields(text))] }
    }
    const problems = registrationProblems(config)
    if (problems.length > 0) {
      return { succeeded: false, problems }
    }

    return { succeeded: true, output: config }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { succeeded: false, problems: [`config: not valid JSON (${error.message})`] }
    }

    throw error
  }
}
