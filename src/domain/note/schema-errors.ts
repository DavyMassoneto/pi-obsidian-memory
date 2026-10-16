import type { TValidationError } from "typebox/error"

import { describeSchemaErrorsWith } from "#src/domain/validation"
import { NoteTypeSchema } from "./schemas.ts"

export function describeNoteSchemaErrors(errors: readonly TValidationError[], label: string): string[] {
  return describeSchemaErrorsWith(errors, label, (error) => noteMessage(error, label))
}

function noteMessage(error: TValidationError, label: string): string | null {
  const field = fieldNameOf(error, label)
  if (error.keyword === "pattern" && field === "id") {
    return "must be a ULID"
  }

  if (error.keyword === "pattern" && (field === "replaces" || field === "replacedBy")) {
    return "must be a wikilink without an alias, heading or block reference ([[folder/Statement]])"
  }

  if (error.keyword === "format" && error.params.format === "date") {
    return "must be a date (YYYY-MM-DD)"
  }

  if (error.keyword === "enum") {
    return `must be one of: ${NoteTypeSchema.enum.join(", ")}`
  }

  if (error.keyword === "const" && typeof error.params.allowedValue === "boolean" && error.params.allowedValue) {
    return "must be true (or left out)"
  }

  return null
}

function fieldNameOf(error: TValidationError, label: string): string {
  if (error.instancePath.length === 0) {
    return label
  }

  return error.instancePath.slice(error.instancePath.lastIndexOf("/") + 1)
}
