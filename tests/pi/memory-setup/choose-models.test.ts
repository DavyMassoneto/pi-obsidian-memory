import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { SETUP_CREATE_OPTION } from "#src/pi"
import { fakePiContext, piRegistrationFixture, SETUP_MODEL } from "#test-helpers"

const CHEAP = { provider: "x", id: "cheap", cost: { input: 0.25, output: 1.25 } }
const OPUS = { provider: "picked", id: "opus", cost: { input: 15, output: 75 } }
const CHEAP_LABEL = "x/cheap · $0.25 in / $1.25 out per 1M tokens"
const OPUS_IN_USE = "picked/opus (in use) · $15 in / $75 out per 1M tokens"

test("on a first run the capture list starts with the model in use, the agent list is sorted by price", async () => {
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  const { context, prompts } = fakePiContext(workingFolder, {
    model: OPUS,
    available: [OPUS, CHEAP],
    answers: {
      selects: [CHEAP_LABEL, "picked/opus · $15 in / $75 out per 1M tokens", SETUP_CREATE_OPTION],
      inputs: [globalVault],
    },
  })

  await pi.runCommand("memory-setup", context)

  const written = JSON.parse(await readFile(configPath, "utf8"))
  expect(written.capture.model).toEqual({ provider: "x", id: "cheap" })
  expect(written.memoryAgent.model).toEqual({ provider: "picked", id: "opus" })
  expect(prompts[0]?.title).toContain("capture")
  expect(prompts[1]?.title).toContain("memory agent")
  expect(prompts[0]?.options).toEqual([OPUS_IN_USE, CHEAP_LABEL])
  expect(prompts[1]?.options).toEqual([CHEAP_LABEL, "picked/opus · $15 in / $75 out per 1M tokens"])
})

test("with Escape on the capture list the model in use is the capture default; the agent must still be chosen", async () => {
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  const { context } = fakePiContext(workingFolder, {
    model: OPUS,
    available: [OPUS, CHEAP],
    answers: { selects: [undefined, CHEAP_LABEL, SETUP_CREATE_OPTION], inputs: [globalVault] },
  })

  await pi.runCommand("memory-setup", context)

  const written = JSON.parse(await readFile(configPath, "utf8"))
  expect(written.capture.model).toEqual({ provider: "picked", id: "opus" })
  expect(written.memoryAgent.model).toEqual({ provider: "x", id: "cheap" })
})

test("the memory agent is never defaulted to pi's model: with no answer on its list nothing is written", async () => {
  const { pi, configPath, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, {
    model: SETUP_MODEL,
    available: [SETUP_MODEL],
    answers: { selects: [undefined, undefined] },
  })

  await pi.runCommand("memory-setup", context)

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(notifications).toEqual([{ message: expect.stringContaining("nothing"), type: "info" }])
})
