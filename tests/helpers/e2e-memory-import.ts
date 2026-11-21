import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { IMPORT_DONE, IMPORT_NO_FILES } from "#src/pi"
import { NO_PROJECT_TO_IMPORT_INTO } from "#src/usecases"
import { notifySettles } from "./e2e-records.ts"
import { type VaultNote, vaultNotes } from "./e2e-vault.ts"
import type { E2eWorld } from "./e2e-world.ts"

export const IMPORT_SETTLES = notifySettles([IMPORT_DONE, IMPORT_NO_FILES, NO_PROJECT_TO_IMPORT_INTO])

export const OM_IMPORTED_FILES = 2

const OM_SESSION = "01a1790f-30c7-72b9-ad65-e98509807e74"

const OM_TOPIC = [
  "---",
  "id: beamer-kvm",
  "title: Beamer KVM firmware",
  "summary: How the Beamer KVM firmware is built and flashed in this project.",
  "updated: 2026-10-20 14:05",
  "---",
  "",
  "# Beamer KVM firmware",
  "",
  "## Build",
  "- The firmware of this project is always built with `make PROBE_HOST=native`; no other probe host is supported.",
  "- The build needs arm-none-eabi-gcc 13; version 14 miscompiles the USB stack of this project.",
  "",
  "## Flashing",
  "- Always flash the firmware with dfu-util 0.11. Never use the vendor flasher: it bricks the board.",
  "- The board enumerates as USB id 1d50:6018 while it is in bootloader mode.",
  "",
].join("\r\n")

const OM_JOURNEY = [
  "# Journey",
  "",
  "## 2026-10-20 14:05",
  "During this period the user set up the Beamer KVM firmware project and asked how it is built. The assistant read the",
  "Makefile and the flashing notes, and recorded the build command and the flashing tool.",
  "",
].join("\n")

const OM_INDEX = "# Index\n\n- beamer-kvm: How the Beamer KVM firmware is built and flashed in this project.\n"

export function omFolderOf(world: E2eWorld): string {
  return join(world.folders.cwd, ".memory")
}

export async function writeOmMemory(world: E2eWorld): Promise<void> {
  const session = join(omFolderOf(world), OM_SESSION)
  await mkdir(join(session, ".runs"), { recursive: true })
  await writeFile(join(session, "beamer-kvm.md"), OM_TOPIC)
  await writeFile(join(session, "JOURNEY.md"), OM_JOURNEY)
  await writeFile(join(session, "INDEX.md"), OM_INDEX)
  await writeFile(join(session, ".runs", "x.json"), JSON.stringify({ observations: [] }))
}

export async function notesOfBothVaults(world: E2eWorld): Promise<VaultNote[]> {
  const vaults = [world.folders.globalVault, world.folders.projectVault]
  return (await Promise.all(vaults.map((vault) => vaultNotes(vault)))).flat()
}
