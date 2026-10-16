import { win32 } from "node:path"

import { isInside } from "#src/domain/config"
import {
  DRIVE_PATH_PREFIXES,
  HOME_PREFIXES,
  PARENT_FOLDER_START,
  PATH_TOKEN_END,
  PATH_TOKEN_START,
  WINDOWS_DRIVE_START,
} from "./constants.ts"

export function commandMentionsVault(command: string, cwd: string, home: string, vaults: string[]): string | null {
  const text = comparableText(command)
  for (const vault of vaults) {
    if (isInside(cwd, vault) || vaultForms(vault, cwd, home).some((form) => appearsIn(text, form))) {
      return vault
    }
  }

  return null
}

function vaultForms(vault: string, cwd: string, home: string): string[] {
  const absolute = comparableText(vault)
  const shellDriveForms = DRIVE_PATH_PREFIXES.flatMap((prefix) => shellDriveForm(absolute, prefix))
  const downFromHome = relativeTo(home, vault).filter((path) => !PARENT_FOLDER_START.test(path))
  const homeForms = downFromHome.flatMap((path) => HOME_PREFIXES.map((prefix) => `${prefix}${path}`))
  const fromCwd = relativeTo(cwd, vault)
  const dotSlashForms = fromCwd.filter((path) => !PARENT_FOLDER_START.test(path)).map((path) => `./${path}`)

  return [absolute, ...shellDriveForms, ...homeForms, ...fromCwd, ...dotSlashForms]
}

function shellDriveForm(absolute: string, prefix: string): string[] {
  if (!WINDOWS_DRIVE_START.test(absolute)) {
    return []
  }

  return [`${prefix}${absolute[0]}${absolute.slice(2)}`]
}

function relativeTo(base: string, vault: string): string[] {
  const relative = comparableText(win32.relative(base, vault))
  if (relative === "" || win32.isAbsolute(relative)) {
    return []
  }

  return [relative]
}

function appearsIn(text: string, form: string): boolean {
  let index = text.indexOf(form)
  while (index !== -1) {
    const before = text.slice(0, index)
    const after = text.slice(index + form.length)
    if (PATH_TOKEN_START.test(before) && PATH_TOKEN_END.test(after)) {
      return true
    }
    index = text.indexOf(form, index + 1)
  }

  return false
}

function comparableText(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/["'`]/g, "")
    .replaceAll("//?/unc/", "//")
    .replaceAll("//?/", "")
    .replace(/\/{2,}/g, "/")
    .replace(/(?<=.)\/$/, "")
}
