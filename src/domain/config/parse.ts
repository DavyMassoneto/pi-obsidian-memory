import { Value } from "typebox/value"

import { describeSchemaErrors } from "#/domain/validation"
import { MemoryConfigSchema } from "./schemas.ts"
import type { ParseConfigResult } from "./types.ts"

export function parseConfig(text: string): ParseConfigResult {
  try {
    const config = JSON.parse(text)
    if (!Value.Check(MemoryConfigSchema, config)) {
      const errors = Value.Errors(MemoryConfigSchema, config)
      return { succeeded: false, problems: describeSchemaErrors(errors, "config") }
    }

    return { succeeded: true, output: config }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { succeeded: false, problems: [`config: not valid JSON (${error.message})`] }
    }

    throw error
  }
}
