import type { StaticParse, TSchema } from "typebox"
import type { TLocalizedValidationError } from "typebox/error"
import { Parse, ParseError } from "typebox/value"

export function parseValue<Schema extends TSchema, Input>(
  schema: Schema,
  value: Input,
  source: string,
): StaticParse<Schema> {
  try {
    return Parse(schema, value)
  } catch (error) {
    if (!(error instanceof ParseError)) throw error
    throw new Error(`${source} fora do formato esperado: ${error.cause.errors.map(describeProblem).join("; ")}`)
  }
}

function describeProblem({ instancePath, message }: TLocalizedValidationError): string {
  if (instancePath === "") return message
  return `${instancePath} ${message}`
}
