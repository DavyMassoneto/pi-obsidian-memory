import type { TValidationError } from "typebox/error"

import { describeSchemaErrors } from "#src/domain/validation"
import type { ConfigObjectRule } from "./types.ts"

export function configValueProblems(path: string, errors: readonly TValidationError[]): string[] {
  const choices: string[] = []
  for (const error of errors) {
    if (error.keyword === "const" && typeof error.params.allowedValue === "string") {
      choices.push(error.params.allowedValue)
    }
  }
  if (choices.length > 0) return [`${configFieldName(path, "")}: must be one of ${choices.join(", ")}`]
  return describeSchemaErrors(errors, "config").map(
    (error) => `${configFieldName(path, "")}: ${error.slice(error.indexOf(":") + 2)}`,
  )
}

export function configObjectProblems(rule: ConfigObjectRule, keys: string[]): string[] {
  const problems: string[] = []
  for (const key of keys) {
    if (!rule.keys.includes(key)) problems.push(`${configFieldName(rule.path, key)}: not a known field`)
  }
  for (const key of rule.required) {
    if (!keys.includes(key)) problems.push(`${configFieldName(rule.path, "")}: must have required properties ${key}`)
  }
  return problems
}

export function configFieldName(path: string, key: string): string {
  const parts = path.split("/").filter(Boolean)
  if (key.length > 0) parts.push(key)
  if (parts.length === 0) return "config"
  return parts.join(".")
}
