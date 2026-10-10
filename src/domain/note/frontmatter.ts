import { type Document, isMap, type Pair, type ParsedNode, parseDocument } from "yaml"

import {
  KNOWN_FRONTMATTER_FIELDS,
  NAME_NOT_TEXT_PROBLEM,
  NOT_FIELDS_PROBLEM,
  REPEATED_FIELD_ERROR_CODE,
} from "./constants.ts"
import {
  fieldNameOf,
  occurrencesOf,
  readDontForget,
  readOptionalField,
  readRequiredField,
  repeatedProblem,
  tagProblems,
  unknownValueProblems,
} from "./frontmatter-fields.ts"
import { NoteDateSchema, NoteIdSchema, NoteLinkSchema, NoteTypeSchema } from "./schemas.ts"
import type { FrontmatterReadings, NoteFrontmatter, OptionalFieldResult, ReadFrontmatterResult } from "./types.ts"

export function readFrontmatter(yaml: string): ReadFrontmatterResult {
  const document = parseDocument(yaml)
  const blockingErrors = document.errors.filter((error) => error.code !== REPEATED_FIELD_ERROR_CODE)
  const yamlProblems = [...blockingErrors, ...document.warnings].map((issue) => `frontmatter: ${issue.message}`)
  if (blockingErrors.length > 0) {
    return { succeeded: false, problems: yamlProblems }
  }

  const root = document.contents
  if (!isMap(root)) {
    return { succeeded: false, problems: [...yamlProblems, NOT_FIELDS_PROBLEM] }
  }

  const pairs = root.items
  const readings = readFields(document, pairs)
  const problems = [
    ...yamlProblems,
    ...tagProblems(document, "frontmatter", root.tag),
    ...nameProblems(document, pairs),
    ...fieldProblems(readings),
    ...unknownFieldProblems(document, pairs),
  ]

  return buildFrontmatter(readings, problems)
}

function readFields(document: Document.Parsed, pairs: Pair<ParsedNode, ParsedNode | null>[]): FrontmatterReadings {
  return {
    id: readRequiredField(document, pairs, "id", NoteIdSchema),
    type: readRequiredField(document, pairs, "type", NoteTypeSchema),
    created: readRequiredField(document, pairs, "created", NoteDateSchema),
    updated: readRequiredField(document, pairs, "updated", NoteDateSchema),
    dontForget: readDontForget(document, pairs),
    archived: readOptionalField(document, pairs, "archived", NoteDateSchema),
    replaces: readOptionalField(document, pairs, "replaces", NoteLinkSchema),
    replacedBy: readOptionalField(document, pairs, "replacedBy", NoteLinkSchema),
  }
}

function fieldProblems(readings: FrontmatterReadings): string[] {
  return [
    ...problemsOf(readings.id),
    ...problemsOf(readings.type),
    ...problemsOf(readings.created),
    ...problemsOf(readings.updated),
    ...problemsOf(readings.dontForget),
    ...problemsOf(readings.archived),
    ...problemsOf(readings.replaces),
    ...problemsOf(readings.replacedBy),
  ]
}

function buildFrontmatter(readings: FrontmatterReadings, problems: string[]): ReadFrontmatterResult {
  const { id, type, created, updated, dontForget, archived, replaces, replacedBy } = readings
  if (problems.length > 0 || !id.succeeded || !type.succeeded || !created.succeeded || !updated.succeeded) {
    return { succeeded: false, problems }
  }

  const frontmatter: NoteFrontmatter = {
    id: id.output,
    type: type.output,
    created: created.output,
    updated: updated.output,
  }

  if (dontForget.succeeded) {
    frontmatter.dontForget = dontForget.output
  }

  if (archived.succeeded) {
    frontmatter.archived = archived.output
  }

  if (replaces.succeeded) {
    frontmatter.replaces = replaces.output
  }

  if (replacedBy.succeeded) {
    frontmatter.replacedBy = replacedBy.output
  }

  return { succeeded: true, output: frontmatter }
}

function nameProblems(document: Document.Parsed, pairs: Pair<ParsedNode, ParsedNode | null>[]): string[] {
  const hasNameThatIsNotText = pairs.some((pair) => !fieldNameOf(pair.key).succeeded)
  const tagged = pairs.flatMap((pair) => nameTagProblems(document, pair.key))

  if (hasNameThatIsNotText) {
    return [NAME_NOT_TEXT_PROBLEM, ...tagged]
  }

  return tagged
}

function nameTagProblems(document: Document.Parsed, key: ParsedNode): string[] {
  const name = fieldNameOf(key)
  if (!name.succeeded) {
    return []
  }

  return tagProblems(document, name.output, key.tag).map((problem) => `${problem} from the name`)
}

function unknownFieldProblems(document: Document.Parsed, pairs: Pair<ParsedNode, ParsedNode | null>[]): string[] {
  const names = pairs.flatMap((pair) => textNamesOf(pair.key))
  const unknown = [...new Set(names)].filter((name) => !KNOWN_FRONTMATTER_FIELDS.includes(name))

  return unknown.flatMap((name) => unknownProblems(document, occurrencesOf(pairs, name), name))
}

function unknownProblems(
  document: Document.Parsed,
  occurrences: Pair<ParsedNode, ParsedNode | null>[],
  name: string,
): string[] {
  const shape = occurrences.flatMap((pair) => unknownValueProblems(document, name, pair.value))

  if (occurrences.length > 1) {
    return [repeatedProblem(name), ...new Set(shape), `${name}: not a known field`]
  }

  return [...shape, `${name}: not a known field`]
}

function textNamesOf(key: ParsedNode): string[] {
  const name = fieldNameOf(key)
  if (name.succeeded) {
    return [name.output]
  }

  return []
}

function problemsOf<Value>(field: OptionalFieldResult<Value>): string[] {
  if ("problems" in field) {
    return field.problems
  }

  return []
}
