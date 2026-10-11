import type { Static, TSchema } from "typebox"
import { Value } from "typebox/value"
import { type Document, isAlias, isMap, isNode, isPair, isScalar, isSeq, type ParsedNode } from "yaml"

import { describeNoteSchemaErrors } from "./schema-errors.ts"
import { DontForgetSchema } from "./schemas.ts"
import type { FieldNameResult, FieldReader, FieldResult, FrontmatterPairs, OptionalFieldResult } from "./types.ts"

export function fieldNameOf(key: ParsedNode): FieldNameResult {
  if (isScalar(key) && typeof key.value === "string") {
    return { succeeded: true, output: key.value }
  }

  return { succeeded: false }
}

export function occurrencesOf(pairs: FrontmatterPairs, name: string): FrontmatterPairs {
  return pairs.filter((pair) => isNamed(pair.key, name))
}

export function readRequiredField<Schema extends TSchema>(
  document: Document.Parsed,
  pairs: FrontmatterPairs,
  name: string,
  schema: Schema,
): FieldResult<Static<Schema>> {
  const field = readOptionalField(document, pairs, name, schema)
  if (field.succeeded || "problems" in field) {
    return field
  }

  return { succeeded: false, problems: [`${name}: is missing`] }
}

export function readOptionalField<Schema extends TSchema>(
  document: Document.Parsed,
  pairs: FrontmatterPairs,
  name: string,
  schema: Schema,
): OptionalFieldResult<Static<Schema>> {
  return readFieldOccurrences(pairs, name, (node) => readText(document, name, node, schema))
}

export function readDontForget(document: Document.Parsed, pairs: FrontmatterPairs): OptionalFieldResult<true> {
  return readFieldOccurrences(pairs, "dontForget", (node) => readFlag(document, "dontForget", node))
}

function readFieldOccurrences<Value>(
  pairs: FrontmatterPairs,
  name: string,
  read: FieldReader<Value>,
): OptionalFieldResult<Value> {
  const [first, ...others] = occurrencesOf(pairs, name)
  if (!isPair(first)) {
    return { succeeded: false }
  }

  if (others.length > 0) {
    return repeatedField(
      name,
      [first, ...others].map((pair) => read(pair.value)),
    )
  }

  return read(first.value)
}

export function shapeProblems(document: Document.Parsed, label: string, node: ParsedNode | null): string[] {
  if (!isNode(node)) {
    return [`${label}: has no value`]
  }

  if (isAlias(node)) {
    return [`${label}: is an alias (*${node.source}); write the value itself`]
  }

  const tagged = tagProblems(document, label, node.tag)
  if (tagged.length > 0) {
    return tagged
  }

  if (isSeq(node)) {
    return [`${label}: must be a single value, not a list`]
  }

  if (isMap(node)) {
    return [`${label}: must be a single value, not a set of fields`]
  }

  return []
}

export function unknownValueProblems(document: Document.Parsed, label: string, node: ParsedNode | null): string[] {
  const shape = shapeProblems(document, label, node)
  if (shape.length > 0) {
    return shape
  }

  if (!isScalar(node)) {
    return [`${label}: has no value`]
  }

  const { value } = node
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return []
  }

  return [`${label}: has no value`]
}

export function tagProblems(document: Document.Parsed, label: string, tag: string | undefined): string[] {
  if (typeof tag !== "string") {
    return []
  }

  return [`${label}: remove the tag ${document.directives.tagString(tag)}`]
}

export function repeatedProblem(name: string): string {
  return `${name}: appears more than once`
}

function readText<Schema extends TSchema>(
  document: Document.Parsed,
  name: string,
  node: ParsedNode | null,
  schema: Schema,
): FieldResult<Static<Schema>> {
  const shape = shapeProblems(document, name, node)
  if (shape.length > 0) {
    return { succeeded: false, problems: shape }
  }

  if (!isScalar(node) || typeof node.value !== "string") {
    return { succeeded: false, problems: [`${name}: must be text`] }
  }

  const text = node.value
  if (Value.Check(schema, text)) {
    return { succeeded: true, output: text }
  }

  return { succeeded: false, problems: describeNoteSchemaErrors(Value.Errors(schema, text), name) }
}

function readFlag(document: Document.Parsed, name: string, node: ParsedNode | null): FieldResult<true> {
  const shape = shapeProblems(document, name, node)
  if (shape.length > 0) {
    return { succeeded: false, problems: shape }
  }

  if (isScalar(node) && typeof node.value === "boolean" && Value.Check(DontForgetSchema, node.value)) {
    return { succeeded: true, output: node.value }
  }

  return { succeeded: false, problems: [`${name}: must be true (or left out)`] }
}

function repeatedField<Value>(name: string, readings: FieldResult<Value>[]): FieldResult<Value> {
  const problems = readings.flatMap((reading) => problemsOf(reading))
  return { succeeded: false, problems: [repeatedProblem(name), ...new Set(problems)] }
}

export function problemsOf<Value>(reading: OptionalFieldResult<Value>): string[] {
  if ("problems" in reading) {
    return reading.problems
  }

  return []
}

function isNamed(key: ParsedNode, name: string): boolean {
  const fieldName = fieldNameOf(key)
  return fieldName.succeeded && fieldName.output === name
}
