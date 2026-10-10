import { expect, test } from "vitest"

import {
  frontmatterLinesWith,
  frontmatterLinesWithListKey,
  readFrontmatterLines,
  validFrontmatterLines,
} from "#test-helpers"

const ulid = "01JABCDE7XKQ2M9V3RTN8WPZ5F"

test("reads the four required fields", () => {
  expect(readFrontmatterLines(validFrontmatterLines())).toEqual({
    succeeded: true,
    output: { id: ulid, type: "rule", created: "2026-10-04", updated: "2026-10-04" },
  })
})

test("reads every optional field, leaving out the absent ones", () => {
  const lines = [
    ...validFrontmatterLines(),
    "dontForget: true",
    "archived: 2026-10-05",
    'replaces: "[[archive/search/Old]]"',
    'replacedBy: "[[search/New]]"',
  ]

  expect(readFrontmatterLines(lines)).toEqual({
    succeeded: true,
    output: {
      id: ulid,
      type: "rule",
      created: "2026-10-04",
      updated: "2026-10-04",
      dontForget: true,
      archived: "2026-10-05",
      replaces: "[[archive/search/Old]]",
      replacedBy: "[[search/New]]",
    },
  })
})

test("accepts comments, quoted names, anchors without aliases and a folded value", () => {
  const lines = [
    "# written in Obsidian",
    `"id": ${ulid}`,
    "type: &kind rule",
    "created: 2026-10-04",
    "updated: 2026-10-04",
    "replacedBy: >-",
    "  [[search/",
    "  New]]",
  ]

  expect(readFrontmatterLines(lines)).toEqual({
    succeeded: true,
    output: { id: ulid, type: "rule", created: "2026-10-04", updated: "2026-10-04", replacedBy: "[[search/ New]]" },
  })
})

test("accepts fields in flow style", () => {
  expect(readFrontmatterLines([`{ id: ${ulid}, type: rule, created: 2026-10-04, updated: 2026-10-04 }`])).toEqual({
    succeeded: true,
    output: { id: ulid, type: "rule", created: "2026-10-04", updated: "2026-10-04" },
  })
})

test.each([
  ["a list", ["- id"]],
  ["a single value", ["just text"]],
  ["nothing", []],
])("reports a frontmatter that is %s instead of fields", (_case, lines) => {
  expect(readFrontmatterLines(lines)).toEqual({
    succeeded: false,
    problems: ["frontmatter: must be fields (name: value)"],
  })
})

test.each([
  ["not valid YAML", ["id: [unclosed"], [expect.stringMatching(/^frontmatter: /)]],
  ["two documents", [...validFrontmatterLines(), "...", "type: rule"], [expect.stringMatching(/^frontmatter: /)]],
  [
    "an unresolved tag",
    frontmatterLinesWith("type: !unsupported rule"),
    [expect.stringMatching(/^frontmatter: /), "type: remove the tag !unsupported"],
  ],
])("reports %s as a YAML problem", (_case, lines, problems) => {
  expect(readFrontmatterLines(lines)).toEqual({ succeeded: false, problems })
})

test.each([
  [
    "a field that is not in the format",
    ["tags: [a]"],
    ["tags: must be a single value, not a list", "tags: not a known field"],
  ],
  ["a field with no value", ["? extra"], ["extra: has no value", "extra: not a known field"]],
  ["an ordered map", ["extra: !!omap [ { a: 1 } ]"], ["extra: remove the tag !!omap", "extra: not a known field"]],
  ["a tag on the name", ["!!str extra: 1"], ["extra: remove the tag !!str from the name", "extra: not a known field"]],
  ["a merge key", ["<<: { extra: 1 }"], ["<<: must be a single value, not a set of fields", "<<: not a known field"]],
  ["a plain unknown field", ["bogus: 1"], ["bogus: not a known field"]],
  ["an empty unknown field", ["extra:"], ["extra: has no value", "extra: not a known field"]],
  ["an unknown field set to null", ["extra: null"], ["extra: has no value", "extra: not a known field"]],
])("reports %s as unknown, with the problems of its value", (_case, extra, problems) => {
  expect(readFrontmatterLines([...validFrontmatterLines(), ...extra])).toEqual({ succeeded: false, problems })
})

test.each([
  ["a field name that is a number", ["1: x"]],
  ["two field names that are lists", ["? [a]", ": 1", "? [b]", ": 2"]],
])("reports %s once", (_case, extra) => {
  expect(readFrontmatterLines([...validFrontmatterLines(), ...extra])).toEqual({
    succeeded: false,
    problems: ["frontmatter: a field name is not text"],
  })
})

test("never lets a field name that is not text stand in for a known field", () => {
  expect(readFrontmatterLines(frontmatterLinesWithListKey())).toEqual({
    succeeded: false,
    problems: ["frontmatter: a field name is not text", expect.stringMatching(/^id: must match pattern/)],
  })
})

test("reports every missing required field", () => {
  expect(readFrontmatterLines(["type: rule"])).toEqual({
    succeeded: false,
    problems: ["id: is missing", "created: is missing", "updated: is missing"],
  })
})

test("reports the shape, type, format, missing and unknown problems together", () => {
  const lines = ["id: not-a-ulid", "type: []", "created: nonsense", "dontForget: false", "bogus: 1"]

  expect(readFrontmatterLines(lines)).toEqual({
    succeeded: false,
    problems: [
      expect.stringMatching(/^id: must match pattern/),
      "type: must be a single value, not a list",
      expect.stringMatching(/^created: must match format/),
      "updated: is missing",
      "dontForget: must be true (or left out)",
      "bogus: not a known field",
    ],
  })
})
