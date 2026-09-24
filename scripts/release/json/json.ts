import { readFileSync, writeFileSync } from "node:fs"

import type { StaticParse, TSchema } from "typebox"
import { Parse, ParseError } from "typebox/value"

import type { JsonFile } from "./types.ts"

export function readJsonFile<Schema extends TSchema>(path: string, schema: Schema): JsonFile<StaticParse<Schema>> {
  const text = readFileSync(path, "utf8")
  return { path, data: parseJson(path, text, schema), lineEnding: text.includes("\r\n") ? "\r\n" : "\n" }
}

export function writeJsonFile<Data>(file: JsonFile<Data>, data: Data): void {
  const json = JSON.stringify(data, null, 2)
  writeFileSync(file.path, json.replaceAll("\n", file.lineEnding) + file.lineEnding)
}

function parseJson<Schema extends TSchema>(path: string, text: string, schema: Schema): StaticParse<Schema> {
  try {
    return Parse(schema, JSON.parse(text))
  } catch (error) {
    if (!(error instanceof ParseError)) throw error
    const problems = error.cause.errors.map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
    throw new Error(`${path} fora do formato esperado: ${problems.join("; ")}`)
  }
}
