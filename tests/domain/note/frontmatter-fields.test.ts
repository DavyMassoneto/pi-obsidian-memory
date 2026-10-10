import { expect, test } from "vitest"

import { frontmatterLinesWith, readFrontmatterLines, validFrontmatterLines } from "#test-helpers"

const ulid = "01JABCDE7XKQ2M9V3RTN8WPZ5F"
const otherUlid = "01JABCDE7XKQ2M9V3RTN8WPZ60"
test.each([
  ["an id that is not a ULID", "id: not-a-ulid", /^id: must match pattern/],
  ["a type outside the list", "type: wish", /^type: /],
  ["an impossible date", "created: 2026-02-30", /^created: must match format/],
  ["a date in another format", "updated: 04/10/2026", /^updated: must match format/],
  ["a lifecycle link that is not a wikilink", 'replaces: "archive/search/Old"', /^replaces: must match pattern/],
  ["an archived date in another format", "archived: yesterday", /^archived: must match format/],
])("reports %s", (_case, line, problem) => {
  expect(readFrontmatterLines(frontmatterLinesWith(line))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(problem)],
  })
})

test.each([
  [
    "an alias",
    [`id: ${ulid}`, "type: rule", "created: &day 2026-10-04", "updated: *day"],
    ["updated: is an alias (*day); write the value itself"],
  ],
  [
    "an alias to nothing",
    frontmatterLinesWith("type: *missing"),
    ["type: is an alias (*missing); write the value itself"],
  ],
  ["a list", frontmatterLinesWith("type: [rule]"), ["type: must be a single value, not a list"]],
  ["a set of fields", frontmatterLinesWith("type: { a: 1 }"), ["type: must be a single value, not a set of fields"]],
  ["a tagged date", frontmatterLinesWith("created: !!timestamp 2026-10-04"), ["created: remove the tag !!timestamp"]],
  ["tagged bytes", frontmatterLinesWith("id: !!binary aGk="), ["id: remove the tag !!binary"]],
  ["a tag on the whole frontmatter", ["!!map", ...validFrontmatterLines()], ["frontmatter: remove the tag !!map"]],
  [
    "a tag on a known field name",
    ["!!str id: 01JABCDE7XKQ2M9V3RTN8WPZ5F", ...validFrontmatterLines().slice(1)],
    ["id: remove the tag !!str from the name"],
  ],
])("reports %s, naming the field", (_case, lines, problems) => {
  expect(readFrontmatterLines(lines)).toEqual({ succeeded: false, problems })
})

test.each([
  ["two valid values", [`id: ${ulid}`, `id: ${otherUlid}`], ["id: appears more than once"]],
  [
    "a valid value, then an invalid one",
    [`id: ${ulid}`, "id: not-a-ulid"],
    ["id: appears more than once", expect.stringMatching(/^id: must match pattern/)],
  ],
  [
    "an invalid value, then a valid one",
    ["id: not-a-ulid", `id: ${ulid}`],
    ["id: appears more than once", expect.stringMatching(/^id: must match pattern/)],
  ],
])("reports a repeated field with %s, choosing no value", (_case, ids, problems) => {
  expect(readFrontmatterLines([...ids, ...validFrontmatterLines().slice(1)])).toEqual({ succeeded: false, problems })
})

test.each([
  ["optional field", ["archived: 2026-10-05", "archived: 2026-10-06"], ["archived: appears more than once"]],
  [
    "dontForget mark",
    ["dontForget: true", "dontForget: false"],
    ["dontForget: appears more than once", "dontForget: must be true (or left out)"],
  ],
  ["unknown field", ["bogus: 1", "bogus: 2"], ["bogus: appears more than once", "bogus: not a known field"]],
])("reports a repeated %s", (_case, extra, problems) => {
  expect(readFrontmatterLines([...validFrontmatterLines(), ...extra])).toEqual({ succeeded: false, problems })
})

test.each([
  ["a number as the id", "id: 123", "id: must be text"],
  ["true as the id", "id: true", "id: must be text"],
  ["true as the created date", "created: true", "created: must be text"],
  ["false as the predecessor link", "replaces: false", "replaces: must be text"],
  ["a number as the updated date", "updated: 20261004", "updated: must be text"],
  ["false as the archived date", "archived: false", "archived: must be text"],
  ["a number as the successor link", "replacedBy: 1", "replacedBy: must be text"],
  ["null as dontForget", "dontForget: null", "dontForget: must be true (or left out)"],
  ["true as the type", "type: true", "type: must be text"],
  ["a number as a date", "created: 20261004", "created: must be text"],
  ["a number as a link", "replaces: 1", "replaces: must be text"],
  ["an empty type", "type:", "type: must be text"],
  ["false as dontForget", "dontForget: false", "dontForget: must be true (or left out)"],
  ["text as dontForget", 'dontForget: "true"', "dontForget: must be true (or left out)"],
  ["a number as dontForget", "dontForget: 1", "dontForget: must be true (or left out)"],
  ["an empty dontForget", "dontForget:", "dontForget: must be true (or left out)"],
])("reports %s", (_case, line, problem) => {
  expect(readFrontmatterLines(frontmatterLinesWith(line))).toEqual({ succeeded: false, problems: [problem] })
})
