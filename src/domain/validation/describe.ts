import type { TLocalizedValidationError } from "typebox/error"

export function describeSchemaErrors(errors: TLocalizedValidationError[], label: string): string[] {
  return errors.flatMap((error) => describeError(error, label))
}

function describeError(error: TLocalizedValidationError, label: string): string[] {
  const path = error.instancePath.slice(1).replaceAll("/", ".")

  if (error.keyword === "additionalProperties") {
    return error.params.additionalProperties.map((field) => `${joinField(path, field)}: not a known field`)
  }

  if (error.keyword === "boolean") {
    return []
  }

  if (path.length === 0) {
    return [`${label}: ${error.message}`]
  }

  return [`${path}: ${error.message}`]
}

function joinField(path: string, field: string): string {
  if (path.length === 0) {
    return field
  }

  return `${path}.${field}`
}
