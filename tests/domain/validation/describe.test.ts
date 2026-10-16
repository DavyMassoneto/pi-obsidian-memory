import Type from "typebox"
import { Value } from "typebox/value"
import { expect, test } from "vitest"

import { describeSchemaErrors } from "#src/domain"

test("describes unknown properties once without repeating their false-schema errors", () => {
  const schema = Type.Object(
    { nested: Type.Object({}, { additionalProperties: false }) },
    { additionalProperties: false },
  )
  const errors = Value.Errors(schema, { nested: { extra: 1 }, other: true })

  expect(errors.some((error) => error.keyword === "boolean")).toBe(true)
  expect(describeSchemaErrors(errors, "config")).toEqual([
    "other: not a known field",
    "nested.extra: not a known field",
  ])
})

test("keeps a false-schema error when it is not an unknown-property duplicate", () => {
  const errors = Value.Errors(Type.Object({}, { additionalProperties: false }), { extra: 1 })
  const booleanErrors = errors.filter((error) => error.keyword === "boolean")

  expect(describeSchemaErrors(booleanErrors, "value")).toEqual(["extra: is not allowed"])
})

test("keeps a forbidden property alongside unknown-property diagnostics", () => {
  const schema = Type.Object({ forbidden: Type.Never() }, { additionalProperties: false })

  expect(describeSchemaErrors(Value.Errors(schema, { forbidden: 1, extra: 2 }), "config")).toEqual([
    "extra: not a known field",
    "forbidden: must not be valid",
  ])
})

test("matches escaped unknown-property names to their duplicate diagnostics", () => {
  const schema = Type.Object({}, { additionalProperties: false })

  expect(describeSchemaErrors(Value.Errors(schema, { "a/b~c": 1 }), "config")).toEqual(["a/b~c: not a known field"])
})

test("does not suppress a boolean error from a different schema at the same property", () => {
  const errors = Value.Errors(Type.Object({}, { additionalProperties: false }), { extra: 1 })
  const distinct = errors.map((error) => {
    if (error.keyword === "boolean") {
      return { ...error, schemaPath: "/properties/extra" }
    }

    return error
  })

  expect(describeSchemaErrors(distinct, "config")).toEqual(["extra: is not allowed", "extra: not a known field"])
})

test("preserves meaningful errors for missing fields, types, lengths and limits", () => {
  const schema = Type.Object({
    name: Type.String({ minLength: 1 }),
    limit: Type.Integer({ minimum: 1 }),
    missing: Type.String(),
  })
  const errors = Value.Errors(schema, { name: "", limit: 0 })

  expect(describeSchemaErrors(errors, "config")).toEqual([
    "config: must have required properties missing",
    "name: must not have fewer than 1 characters",
    "limit: must be >= 1",
  ])
})

test("joins nested property paths with dots and keeps tildes in names", () => {
  const schema = Type.Object({ n: Type.Object({ "x~y": Type.String() }) })

  expect(describeSchemaErrors(Value.Errors(schema, { n: { "x~y": 1 } }), "config")).toEqual(["n.x~y: must be string"])
})

test("suppresses the false-schema duplicate whether the error path is raw or an escaped JSON pointer", () => {
  const errors = Value.Errors(Type.Object({}, { additionalProperties: false }), { "a/b~c": 1 })
  const escaped = errors.map((error) => {
    if (error.keyword === "boolean") return { ...error, instancePath: "/a~1b~0c" }
    return error
  })

  expect(describeSchemaErrors(escaped, "config")).toEqual(["a/b~c: not a known field"])
})

test("writes its own text from the error data, not from the message the host typebox produced", () => {
  const schema = Type.Object({
    name: Type.String({ minLength: 1 }),
    limit: Type.Integer({ minimum: 1 }),
    missing: Type.String(),
  })
  const errors = Value.Errors(schema, { name: "", limit: 0 }).map((error) => ({ ...error, message: "host wording" }))

  expect(describeSchemaErrors(errors, "config")).toEqual([
    "config: must have required properties missing",
    "name: must not have fewer than 1 characters",
    "limit: must be >= 1",
  ])
})

test.each([
  ["a type", Type.String(), 1, "must be string"],
  ["several types", Type.Unsafe({ type: ["string", "number"] }), true, "must be either string or number"],
  ["a maximum length", Type.String({ maxLength: 1 }), "bb", "must not have more than 1 characters"],
  ["a maximum", Type.Integer({ maximum: 1 }), 2, "must be <= 1"],
  ["an exclusive minimum", Type.Number({ exclusiveMinimum: 1 }), 1, "must be > 1"],
  ["an exclusive maximum", Type.Number({ exclusiveMaximum: 1 }), 1, "must be < 1"],
  ["a minimum item count", Type.Array(Type.Number(), { minItems: 1 }), [], "must not have fewer than 1 items"],
  ["a maximum item count", Type.Array(Type.Number(), { maxItems: 1 }), [1, 2], "must not have more than 1 items"],
  ["an enum", Type.Enum(["a", "b"]), "c", "must be equal to one of the allowed values"],
  ["a constant", Type.Literal(true), false, "must be equal to constant"],
  ["a pattern", Type.String({ pattern: "^a$" }), "b", 'must match pattern "^a$"'],
  ["a format", Type.String({ format: "date" }), "x", 'must match format "date"'],
  ["a forbidden value", Type.Never(), 1, "must not be valid"],
])("describes %s", (_case, schema, value, expected) => {
  const errors = Value.Errors(schema, value).map((error) => ({ ...error, message: "host wording" }))

  expect(describeSchemaErrors(errors, "value")).toContain(`value: ${expected}`)
})

test("describes a union failure and a keyword without a dedicated text in its own words", () => {
  const union = Value.Errors(Type.Union([Type.String(), Type.Number()]), true)
  const unique = Value.Errors(Type.Array(Type.Number(), { uniqueItems: true }), [1, 1])

  expect(describeSchemaErrors(union, "value")).toContain("value: must match a schema in anyOf")
  expect(describeSchemaErrors(unique, "value")).toEqual(["value: is invalid (uniqueItems)"])
})

test.each([
  ["a key with a slash and a tilde", "/a~1b~0c", "a/b~c: must be string"],
  ["a nested escaped key", "/n/x~0y", "n.x~y: must be string"],
  ["a nested path that is not escaped", "/n/x", "n.x: must be string"],
])("decodes an escaped JSON-pointer path only when it is escaped: %s", (_case, instancePath, expected) => {
  const error = { keyword: "type" as const, schemaPath: "#", instancePath, params: { type: "string" }, message: "m" }

  expect(describeSchemaErrors([error], "config")).toEqual([expected])
})
