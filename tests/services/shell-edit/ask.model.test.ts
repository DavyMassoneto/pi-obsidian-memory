import { expect, test } from "vitest"

import { SHELL_EDIT_QUESTION_NAMES } from "#src/domain"
import { measureQuestion, renderShellEditReport, scoreLabelledCommands } from "#test-helpers"

test("measures each shell-edit question on labelled commands; every question separates on the check group", async () => {
  const scored = await scoreLabelledCommands()
  const measures = SHELL_EDIT_QUESTION_NAMES.map((name) => measureQuestion(scored, name))
  console.info(renderShellEditReport(scored, measures))
  expect(measures.filter((measure) => !measure.separates).map((measure) => measure.name)).toEqual([])
})
