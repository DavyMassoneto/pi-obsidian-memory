import { expect, test } from "vitest"

import { loadDontForget, refreshLoaded, trackDontForget } from "#src/usecases"
import { noteWithId, putCatalogFile, putDontForget, relevantFixture } from "#test-helpers"

test("every Don't forget note that was loaded is remembered, so a later edit is noticed", async () => {
  const fixture = await relevantFixture({ laya: null })
  const path = await putDontForget(fixture.vault, "Never rm", 1, "Never rm -rf.")
  const loaded = await loadDontForget(fixture.context)

  trackDontForget(fixture.loaded, loaded)
  await putCatalogFile(fixture.vault, path, noteWithId(1, "Never rm, ever.", ["dontForget: true"]))
  const { blocks } = await refreshLoaded(fixture.loaded, fixture.context)

  expect(blocks).toHaveLength(1)
  expect(blocks[0]).toContain(`replaces the earlier copy of "global · ${path}"`)
  expect(blocks[0]).toContain("ever.")
})

test("a failed load remembers nothing", async () => {
  const fixture = await relevantFixture({ laya: null })

  trackDontForget(fixture.loaded, {
    succeeded: false,
    reason: "config-unavailable",
    configPath: "c",
    problems: ["no config"],
  })

  expect(fixture.loaded.all()).toEqual([])
})

test("a Don't forget note without a body is not remembered, since it could not be read again", async () => {
  const fixture = await relevantFixture({ laya: null })
  await putCatalogFile(fixture.vault, "Empty.md", noteWithId(2, "", ["dontForget: true"]))
  const loaded = await loadDontForget(fixture.context)

  trackDontForget(fixture.loaded, loaded)

  expect(fixture.loaded.all()).toEqual([])
})
