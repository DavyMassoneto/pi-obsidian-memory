import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { checkShellEdit } from "#src/usecases"
import { invalidKeyShellEditJev, liveShellEditJev, resetShellEditProject, useTempFolder } from "#test-helpers"

test("refuses a script that exists but cannot be read, whatever Jev would answer", async () => {
  const cwd = await useTempFolder()
  await mkdir(join(cwd, "dir.js"))
  const result = await checkShellEdit(
    { command: "node dir.js", cwd },
    { jev: invalidKeyShellEditJev, signal: new AbortController().signal },
  )
  expect(result.succeeded).toBe(false)
  expect("problems" in result && result.problems[0]).toContain(
    `Refused: the shell-edit guard could not check this command: ${join(cwd, "dir.js")} cannot be read: Error: EISDIR: illegal operation on a directory, read. The shell never creates`,
  )
  expect("problems" in result && result.problems[0]).not.toContain("Jev")
})

test("refuses with the cause Jev returned when the key is invalid", async () => {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const result = await checkShellEdit(
    { command: "npm test", cwd },
    { jev: invalidKeyShellEditJev, signal: new AbortController().signal },
  )
  expect(result.succeeded).toBe(false)
  expect("problems" in result && result.problems[0]).toContain(
    'Refused: the shell-edit guard could not check this command: Jev reported an error: System One API error (401): {"detail":{"error_type":"authentication_error","message":"Cannot authenticate with the server. Please check your API key and try again."}}.',
  )
})

test("refuses a redirection naming its question and pointing to edit and write", async () => {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const result = await checkShellEdit(
    { command: "echo x > notes.txt", cwd },
    { jev: liveShellEditJev, signal: new AbortController().signal },
  )
  expect(result.succeeded).toBe(false)
  expect("problems" in result && result.problems[0]).toContain("redirection")
  expect("problems" in result && result.problems[0]).toContain("edit or write")
})

test("refuses a script that writes a file, naming script_writes", async () => {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const result = await checkShellEdit(
    { command: "node write.js", cwd },
    { jev: liveShellEditJev, signal: new AbortController().signal },
  )
  expect(result.succeeded).toBe(false)
  expect("problems" in result && result.problems[0]).toContain("script_writes")
})

test("lets a test run through", async () => {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const result = await checkShellEdit(
    { command: "npm test", cwd },
    { jev: liveShellEditJev, signal: new AbortController().signal },
  )
  expect(result).toEqual({ succeeded: true })
})

test("cancels without a verdict when the signal is already aborted", async () => {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const controller = new AbortController()
  controller.abort()
  const result = await checkShellEdit(
    { command: "npm test", cwd },
    { jev: liveShellEditJev, signal: controller.signal },
  )
  expect(result.succeeded).toBe(false)
  expect("problems" in result && result.problems[0]).toContain("cancelled")
})
