import { Value } from "typebox/value"
import { expect, test } from "vitest"

import {
  DontForgetSchema,
  describeNoteSchemaErrors,
  NoteDateSchema,
  NoteIdSchema,
  NoteLinkSchema,
  NoteTypeSchema,
} from "#/domain"

test("describes an invalid id as a ULID rather than a regular expression", () => {
  expect(describeNoteSchemaErrors(Value.Errors(NoteIdSchema, "invalid"), "id")).toEqual(["id: must be a ULID"])
})

test.each(["created", "updated", "archived"])("names invalid %s dates in the expected format", (field) => {
  expect(describeNoteSchemaErrors(Value.Errors(NoteDateSchema, "2026-02-30"), field)).toEqual([
    `${field}: must be a date (YYYY-MM-DD)`,
  ])
})

test.each(["replaces", "replacedBy"])("explains the required %s link syntax", (field) => {
  expect(describeNoteSchemaErrors(Value.Errors(NoteLinkSchema, "[[note#heading]]"), field)).toEqual([
    `${field}: must be a wikilink without an alias, heading or block reference ([[folder/Statement]])`,
  ])
})

test("explains the allowed memory types without silently accepting another type", () => {
  expect(describeNoteSchemaErrors(Value.Errors(NoteTypeSchema, "wish"), "type")).toEqual([
    "type: must be one of: rule, procedure, constraint, fact, issue, question, decision, lesson, goal, risk, idea, reference",
  ])
})

test("explains that a false dontForget flag must be omitted", () => {
  expect(describeNoteSchemaErrors(Value.Errors(DontForgetSchema, false), "dontForget")).toEqual([
    "dontForget: must be true (or left out)",
  ])
})

test("preserves type errors instead of claiming a format error for a non-string", () => {
  expect(describeNoteSchemaErrors(Value.Errors(NoteIdSchema, 123), "id")).toEqual(["id: must be string"])
})
