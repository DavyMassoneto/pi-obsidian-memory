import type { TValidationError } from "typebox/error"

import { ESCAPED_POINTER } from "./constants.ts"
import type { ErrorMessageOverride } from "./types.ts"

export function describeSchemaErrors(errors: readonly TValidationError[], label: string): string[] {
  return describeSchemaErrorsWith(errors, label, noOverride)
}

export function describeSchemaErrorsWith(
  errors: readonly TValidationError[],
  label: string,
  override: ErrorMessageOverride,
): string[] {
  return errors
    .filter((error) => !isReportedUnknownProperty(error, errors))
    .flatMap((error) => describeError(error, label, override))
}

function noOverride(): null {
  return null
}

function isReportedUnknownProperty(error: TValidationError, errors: readonly TValidationError[]): boolean {
  if (error.keyword !== "boolean") {
    return false
  }

  return errors.some(
    (other) =>
      other.keyword === "additionalProperties" &&
      error.schemaPath === `${other.schemaPath}/additionalProperties` &&
      other.params.additionalProperties.some((field) =>
        [field, escapePointer(field)].some((name) => error.instancePath === `${other.instancePath}/${name}`),
      ),
  )
}

function describeError(error: TValidationError, label: string, override: ErrorMessageOverride): string[] {
  const path = readablePath(error.instancePath)

  if (error.keyword === "additionalProperties") {
    return error.params.additionalProperties.map((field) => `${joinField(path, field)}: not a known field`)
  }

  let message = keywordMessage(error)
  const custom = override(error)
  if (custom) {
    message = custom
  }

  if (path.length === 0) {
    return [`${label}: ${message}`]
  }

  return [`${path}: ${message}`]
}

function keywordMessage(error: TValidationError): string {
  switch (error.keyword) {
    case "type":
      return typeMessage(error.params.type)
    case "required":
      return `must have required properties ${error.params.requiredProperties.join(", ")}`
    case "enum":
      return "must be equal to one of the allowed values"
    case "const":
      return "must be equal to constant"
    case "pattern":
      return `must match pattern "${String(error.params.pattern)}"`
    case "format":
      return `must match format "${error.params.format}"`
    case "not":
      return "must not be valid"
    case "boolean":
      return "is not allowed"
    case "anyOf":
      return "must match a schema in anyOf"
    case "oneOf":
      return "must match exactly one schema in oneOf"
    default:
      return limitMessage(error)
  }
}

function limitMessage(error: TValidationError): string {
  switch (error.keyword) {
    case "minLength":
      return `must not have fewer than ${error.params.limit} characters`
    case "maxLength":
      return `must not have more than ${error.params.limit} characters`
    case "minItems":
      return `must not have fewer than ${error.params.limit} items`
    case "maxItems":
      return `must not have more than ${error.params.limit} items`
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
      return `must be ${error.params.comparison} ${error.params.limit}`
    default:
      return `is invalid (${error.keyword})`
  }
}

function typeMessage(type: string | string[]): string {
  if (typeof type === "string") {
    return `must be ${type}`
  }

  return `must be either ${type.join(" or ")}`
}

function readablePath(instancePath: string): string {
  const segments = instancePath.slice(1).split("/")
  if (!ESCAPED_POINTER.test(instancePath)) {
    return segments.join(".")
  }

  return segments.map(unescapePointer).join(".")
}

function unescapePointer(field: string): string {
  return field.replaceAll("~1", "/").replaceAll("~0", "~")
}

function escapePointer(field: string): string {
  return field.replaceAll("~", "~0").replaceAll("/", "~1")
}

function joinField(path: string, field: string): string {
  if (path.length === 0) {
    return field
  }

  return `${path}.${field}`
}
