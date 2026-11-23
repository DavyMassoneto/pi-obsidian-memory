import { describe, expect, it } from "vitest"

import {
  entryParts,
  MEMORY_ADD_TOOL_NAME,
  MEMORY_ARCHIVE_TOOL_NAME,
  MEMORY_DOCTOR_COMMAND,
  MEMORY_EXPORT_COMMAND,
  MEMORY_GET_TOOL_NAME,
  MEMORY_IMPORT_COMMAND,
  MEMORY_INIT_COMMAND,
  MEMORY_SEARCH_TOOL_NAME,
  MEMORY_SETUP_COMMAND,
  MEMORY_SUCCEED_TOOL_NAME,
  MEMORY_UPDATE_TOOL_NAME,
} from "#src/pi"

describe("entry parts", () => {
  it("the full entry has the six memory tools, the five memory commands, the injection, both guards and the cycle", () => {
    const parts = entryParts("full")

    expect([...parts.tools].sort()).toEqual(
      [
        MEMORY_ADD_TOOL_NAME,
        MEMORY_ARCHIVE_TOOL_NAME,
        MEMORY_GET_TOOL_NAME,
        MEMORY_SEARCH_TOOL_NAME,
        MEMORY_SUCCEED_TOOL_NAME,
        MEMORY_UPDATE_TOOL_NAME,
      ].sort(),
    )
    expect([...parts.commands].sort()).toEqual(
      [
        MEMORY_DOCTOR_COMMAND,
        MEMORY_EXPORT_COMMAND,
        MEMORY_IMPORT_COMMAND,
        MEMORY_INIT_COMMAND,
        MEMORY_SETUP_COMMAND,
      ].sort(),
    )
    expect(parts).toMatchObject({ injection: true, vaultGuard: true, cycle: true })
  })

  it("the read-only entry has only memory_search and memory_get", () => {
    expect([...entryParts("read-only").tools].sort()).toEqual([MEMORY_GET_TOOL_NAME, MEMORY_SEARCH_TOOL_NAME].sort())
  })

  it("the read-only entry has no memory command", () => {
    expect(entryParts("read-only").commands).toEqual([])
  })

  it("the read-only entry keeps the injection and the vault guard", () => {
    expect(entryParts("read-only")).toMatchObject({ injection: true, vaultGuard: true })
  })

  it("the read-only entry has no observation cycle", () => {
    expect(entryParts("read-only")).toMatchObject({ cycle: false })
  })
})
