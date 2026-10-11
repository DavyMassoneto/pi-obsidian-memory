import type { TLocalizedValidationError } from "typebox/error"

export function describeSchemaErrors(errors: TLocalizedValidationError[], label: string): string[] {
  return errors
    .filter((error) => !isReportedUnknownProperty(error, errors))
    .flatMap((error) => describeError(error, label))
}

function isReportedUnknownProperty(error: TLocalizedValidationError, errors: TLocalizedValidationError[]): boolean {
  if (error.keyword !== "boolean") {
    return false
  }

  return errors.some(
    (other) =>
      other.keyword === "additionalProperties" &&
      error.schemaPath === `${other.schemaPath}/additionalProperties` &&
      other.params.additionalProperties.some(
        (field) => error.instancePath === `${other.instancePath}/${escapePointer(field)}`,
      ),
  )
}

function describeError(error: TLocalizedValidationError, label: string): string[] {
  const path = error.instancePath.slice(1).split("/").map(unescapePointer).join(".")

  if (error.keyword === "additionalProperties") {
    return error.params.additionalProperties.map((field) => `${joinField(path, field)}: not a known field`)
  }

  let message = error.message
  if (error.keyword === "boolean") {
    message = "is not allowed"
  }

  if (path.length === 0) {
    return [`${label}: ${message}`]
  }

  return [`${path}: ${message}`]
}

function escapePointer(field: string): string {
  return field.replaceAll("~", "~0").replaceAll("/", "~1")
}

function unescapePointer(field: string): string {
  return field.replaceAll("~1", "/").replaceAll("~0", "~")
}

function joinField(path: string, field: string): string {
  if (path.length === 0) {
    return field
  }

  return `${path}.${field}`
}
