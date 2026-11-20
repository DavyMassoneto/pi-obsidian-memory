import { join } from "node:path"

import { describe, expect, it, onTestFinished } from "vitest"

import { acquireIndexLock } from "#src/services"
import {
  FIRST_RECOVERED_ID,
  type HeldOperationRun,
  type IndexOperation,
  operationAgainstHeldLock,
  recoveryAgainstHeldLock,
  SECOND_RECOVERED_ID,
  useTempFolder,
} from "#test-helpers"

const SAVED = JSON.stringify({ succeeded: true })

function expectAnsweredAfterTheSignal(run: HeldOperationRun): void {
  expect(run.events).toEqual(["signal", "answered"])
}

async function expectWriteSaved(operation: IndexOperation) {
  const run = await operationAgainstHeldLock(operation, "release")
  expectAnsweredAfterTheSignal(run)
  expect(run.outcome).toBe(SAVED)
  expect(run.savedAfterwards).toBe(true)
  return run
}

async function expectReadAnswered(operation: IndexOperation) {
  const run = await operationAgainstHeldLock(operation, "release")
  expectAnsweredAfterTheSignal(run)
  expect(run.expected).toContain('"succeeded":true')
  expect(run.outcome).toBe(run.expected)
}

describe("index lock", () => {
  it("a note write while another process holds the lock returns after the release and is saved", async () => {
    const run = await expectWriteSaved("put")

    expect(run.folderFiles).toEqual(["vault.sqlite"])
  })

  it("a vector write while another process holds the lock returns after the release and is saved", async () => {
    await expectWriteSaved("replaceVectors")
  })

  it("a folder index state write while another process holds the lock returns after the release and is saved", async () => {
    await expectWriteSaved("recordFolderIndexes")
  })

  it("a writer waiting on a holder process that is killed returns after the kill and is saved", async () => {
    const run = await operationAgainstHeldLock("put", "kill")

    expectAnsweredAfterTheSignal(run)
    expect(run.outcome).toBe(SAVED)
    expect(run.savedAfterwards).toBe(true)
  })

  it("an index open while another process holds the lock returns after the release with a usable index", async () => {
    await expectReadAnswered("open")
  })

  it("a search while another process holds the lock returns after the release with its results", async () => {
    await expectReadAnswered("search")
  })

  it("a catalog search while another process holds the lock returns after the release with its results", async () => {
    await expectReadAnswered("searchCatalog")
  })

  it("an inventory read while another process holds the lock returns after the release with the inventory", async () => {
    await expectReadAnswered("inventory")
  })

  it("a vector read while another process holds the lock returns after the release with the vectors", async () => {
    await expectReadAnswered("vectors")
  })

  it("a vector coverage read while another process holds the lock returns after the release with the coverage", async () => {
    await expectReadAnswered("vectorCoverage")
  })

  it("a folder index state read while another process holds the lock returns after the release with the states", async () => {
    await expectReadAnswered("folderIndexes")
  })

  it("two processes recovering an index whose corruption only the reads find rebuild it once and keep both writes", async () => {
    const run = await recoveryAgainstHeldLock("invalid-row")

    expect(run.events).toEqual(["signal", "answered"])
    expect([...run.rebuilt].sort()).toEqual([false, true])
    expect(run.storedIds).toEqual([FIRST_RECOVERED_ID, SECOND_RECOVERED_ID])
    expect(run.folderFiles).toEqual(["vault.sqlite"])
  })

  it("two processes recovering an index that is not a database rebuild it once and keep both writes", async () => {
    const run = await recoveryAgainstHeldLock("not-a-database")

    expect(run.events).toEqual(["signal", "answered"])
    expect([...run.rebuilt].sort()).toEqual([false, true])
    expect(run.storedIds).toEqual([FIRST_RECOVERED_ID, SECOND_RECOVERED_ID])
    expect(run.folderFiles).toEqual(["vault.sqlite"])
  })

  it("a second request from the process that holds the lock returns unavailable at once", async () => {
    const path = join(await useTempFolder(), "vault.sqlite")
    const held = acquireIndexLock(path)
    if (!held.succeeded) throw new Error(held.problems.join("; "))
    onTestFinished(() => held.output.release())

    expect(acquireIndexLock(path)).toMatchObject({ succeeded: false, reason: "unavailable" })
  })
})
