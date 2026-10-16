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

test("decodes escaped property paths in diagnostics", () => {
  const schema = Type.Object({ "a/b~c": Type.String() })

  expect(describeSchemaErrors(Value.Errors(schema, { "a/b~c": 1 }), "config")).toEqual(["a/b~c: must be string"])
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
