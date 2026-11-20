import { MEMORY_ADD_TOOL_NAME } from "#src/pi/memory-add"
import { MEMORY_ARCHIVE_TOOL_NAME } from "#src/pi/memory-archive"
import { MEMORY_DOCTOR_COMMAND } from "#src/pi/memory-doctor"
import { MEMORY_EXPORT_COMMAND } from "#src/pi/memory-export"
import { MEMORY_GET_TOOL_NAME } from "#src/pi/memory-get"
import { MEMORY_IMPORT_COMMAND } from "#src/pi/memory-import"
import { MEMORY_INIT_COMMAND } from "#src/pi/memory-init"
import { MEMORY_SEARCH_TOOL_NAME } from "#src/pi/memory-search"
import { MEMORY_SETUP_COMMAND } from "#src/pi/memory-setup"
import { MEMORY_SUCCEED_TOOL_NAME } from "#src/pi/memory-succeed"
import { MEMORY_UPDATE_TOOL_NAME } from "#src/pi/memory-update"
import type { EntryMode, EntryParts } from "./types.ts"

export function entryParts(mode: EntryMode): EntryParts {
  if (mode === "read-only") {
    return {
      tools: [MEMORY_SEARCH_TOOL_NAME, MEMORY_GET_TOOL_NAME],
      commands: [],
      injection: true,
      vaultGuard: true,
      shellEditGuard: false,
      cycle: false,
    }
  }
  return {
    tools: [
      MEMORY_ADD_TOOL_NAME,
      MEMORY_SEARCH_TOOL_NAME,
      MEMORY_GET_TOOL_NAME,
      MEMORY_UPDATE_TOOL_NAME,
      MEMORY_ARCHIVE_TOOL_NAME,
      MEMORY_SUCCEED_TOOL_NAME,
    ],
    commands: [
      MEMORY_SETUP_COMMAND,
      MEMORY_INIT_COMMAND,
      MEMORY_EXPORT_COMMAND,
      MEMORY_IMPORT_COMMAND,
      MEMORY_DOCTOR_COMMAND,
    ],
    injection: true,
    vaultGuard: true,
    shellEditGuard: true,
    cycle: true,
  }
}
