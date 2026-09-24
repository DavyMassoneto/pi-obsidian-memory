import { readFileSync, writeFileSync } from "node:fs"

import type { StaticParse, TSchema } from "typebox"
import type { TLocalizedValidationError } from "typebox/error"
import { Parse, ParseError } from "typebox/value"

import type { JsonFile } from "./types.ts"

export function readJsonFile<Schema extends TSchema>(path: string, schema: Schema): JsonFile<StaticParse<Schema>> {
  const text = readFileSync(path, "utf8")
  return { path, data: parseJson(path, text, schema), lineEnding: lineEndingOf(text) }
}

export function writeJsonFile<Data>(file: JsonFile<Data>, data: Data): void {
  const json = JSON.stringify(data, null, 2)
  writeFileSync(file.path, json.replaceAll("\n", file.lineEnding) + file.lineEnding)
}

function lineEndingOf(text: string): string {
  if (text.includes("\r\n")) return "\r\n"
  return "\n"
}

function parseJson<Schema extends TSchema>(path: string, text: string, schema: Schema): StaticParse<Schema> {
  try {
    return Parse(schema, JSON.parse(text))
  } catch (error) {
    if (!(error instanceof ParseError)) throw error
    throw new Error(`${path} fora do formato esperado: ${error.cause.errors.map(describeProblem).join("; ")}`)
  }
}

function describeProblem({ instancePath, message }: TLocalizedValidationError): string {
  if (instancePath === "") return message
  return `${instancePath} ${message}`
}
