import type { TLocalizedValidationError } from "typebox/error"

import { describeSchemaErrors } from "#/domain/validation"
import { NoteTypeSchema } from "./schemas.ts"

export function describeNoteSchemaErrors(errors: TLocalizedValidationError[], label: string): string[] {
  return describeSchemaErrors(
    errors.map((error) => withNoteMessage(error, label)),
    label,
  )
}

function withNoteMessage(error: TLocalizedValidationError, label: string): TLocalizedValidationError {
  const field = fieldNameOf(error, label)
  if (error.keyword === "pattern" && field === "id") {
    return { ...error, message: "must be a ULID" }
  }

  if (error.keyword === "pattern" && (field === "replaces" || field === "replacedBy")) {
    return {
      ...error,
      message: "must be a wikilink without an alias, heading or block reference ([[folder/Statement]])",
    }
  }

  if (error.keyword === "format" && error.params.format === "date") {
    return { ...error, message: "must be a date (YYYY-MM-DD)" }
  }

  if (error.keyword === "enum") {
    return { ...error, message: `must be one of: ${NoteTypeSchema.enum.join(", ")}` }
  }

  if (error.keyword === "const" && typeof error.params.allowedValue === "boolean" && error.params.allowedValue) {
    return { ...error, message: "must be true (or left out)" }
  }

  return error
}

function fieldNameOf(error: TLocalizedValidationError, label: string): string {
  if (error.instancePath.length === 0) {
    return label
  }

  return error.instancePath.slice(error.instancePath.lastIndexOf("/") + 1)
}
