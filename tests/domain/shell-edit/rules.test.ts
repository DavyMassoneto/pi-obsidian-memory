import { expect, test } from "vitest"

import {
  firedQuestions,
  SHELL_EDIT_GUIDANCE,
  SHELL_EDIT_QUESTION_NAMES,
  SHELL_EDIT_QUESTIONS,
  SHELL_EDIT_REFUSED,
  SHELL_EDIT_UNCHECKED,
  shellEditRefusal,
  shellEditUncheckable,
} from "#src/domain"

test("a question fires when its answer is at or above its own cutoff", () => {
  const cutoffs = {
    redirection: 0.5,
    in_place: 0.4,
    inline_code: 0.3,
    script_writes: 0.6,
    copy_download: 0.5,
    hardlink: 0.2,
  }
  const scores = {
    redirection: 0.5,
    in_place: 0.39,
    inline_code: 0.31,
    script_writes: 0.59,
    copy_download: 0,
    hardlink: 0.2,
  }
  expect(firedQuestions(scores, cutoffs)).toEqual(["redirection", "inline_code", "hardlink"])
})

test("no answer at or above its cutoff fires nothing", () => {
  const cutoffs = {
    redirection: 0.5,
    in_place: 0.5,
    inline_code: 0.5,
    script_writes: 0.5,
    copy_download: 0.5,
    hardlink: 0.5,
  }
  const scores = {
    redirection: 0.49,
    in_place: 0,
    inline_code: 0.1,
    script_writes: 0.2,
    copy_download: 0.3,
    hardlink: 0.4,
  }
  expect(firedQuestions(scores, cutoffs)).toEqual([])
})

test("the refusal names the questions and points to edit and write", () => {
  expect(shellEditRefusal(["redirection", "hardlink"])).toBe(
    `${SHELL_EDIT_REFUSED} (redirection, hardlink). ${SHELL_EDIT_GUIDANCE}`,
  )
  expect(shellEditUncheckable("no Jev")).toBe(`${SHELL_EDIT_UNCHECKED}: no Jev. ${SHELL_EDIT_GUIDANCE}`)
  expect(SHELL_EDIT_GUIDANCE).toContain("edit or write")
})

test("a cause that ends in a period does not double it", () => {
  expect(shellEditUncheckable("no Jev.")).toBe(`${SHELL_EDIT_UNCHECKED}: no Jev. ${SHELL_EDIT_GUIDANCE}`)
})

test("every question names the state path it looks at", () => {
  const statePathByQuestion = {
    redirection: "`command`",
    in_place: "`command`",
    inline_code: "`command`",
    script_writes: "`scripts[*].text`",
    copy_download: "`command`",
    hardlink: "`command`",
  }
  expect(SHELL_EDIT_QUESTION_NAMES).toEqual(Object.keys(statePathByQuestion))
  for (const name of SHELL_EDIT_QUESTION_NAMES) {
    expect(SHELL_EDIT_QUESTIONS[name].instructions).toContain(statePathByQuestion[name])
    expect(SHELL_EDIT_QUESTIONS[name].instructions).toMatch(/^Does .*\?$/)
  }
})

test("the redirection question speaks of a file-writing cmdlet", () => {
  expect(SHELL_EDIT_QUESTIONS.redirection.instructions).toContain("file-writing cmdlet")
})
