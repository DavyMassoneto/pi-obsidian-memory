import { win32 } from "node:path"

import { isInside } from "#src/domain/config"
import { argumentTokens } from "./argument-tokens.ts"
import {
  COMPARABLE_ADMIN_SHARE,
  COMPARABLE_NAMESPACE,
  COMPARABLE_NAMESPACE_UNC,
  DRIVE_PATH_PREFIXES,
  HOME_PREFIXES,
  PARENT_FOLDER_START,
  PATH_FOLLOWS,
  PATH_TOKEN_END,
  PATH_TOKEN_START,
  WINDOWS_DRIVE_START,
} from "./constants.ts"
import type { VaultForms } from "./types.ts"

export function commandMentionsVault(command: string, cwd: string, home: string, vaults: string[]): string | null {
  const text = comparableText(command)
  const tokens = argumentTokens(command).map((token) => comparableText(token).replace(/(?<=.)\.+$/, ""))
  for (const vault of vaults) {
    if (isInside(cwd, vault) || mentionsForms(text, tokens, vaultForms(vault, cwd, home))) {
      return vault
    }
  }

  return null
}

function mentionsForms(text: string, tokens: string[], forms: VaultForms): boolean {
  return (
    forms.anywhere.some((form) => appearsIn(text, form, PATH_TOKEN_END)) ||
    forms.relative.some((form) => tokens.includes(form) || appearsIn(text, form, PATH_FOLLOWS))
  )
}

function vaultForms(vault: string, cwd: string, home: string): VaultForms {
  const absolute = comparableText(vault)
  const shellDriveForms = DRIVE_PATH_PREFIXES.flatMap((prefix) => shellDriveForm(absolute, prefix))
  const downFromHome = relativeTo(home, vault).filter((path) => !PARENT_FOLDER_START.test(path))
  const homeForms = downFromHome.flatMap((path) => HOME_PREFIXES.map((prefix) => `${prefix}${path}`))
  const fromCwd = relativeTo(cwd, vault)
  const dotSlashForms = fromCwd.filter((path) => !PARENT_FOLDER_START.test(path)).map((path) => `./${path}`)

  return { anywhere: [absolute, ...shellDriveForms, ...homeForms], relative: [...fromCwd, ...dotSlashForms] }
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

function appearsIn(text: string, form: string, end: RegExp): boolean {
  let index = text.indexOf(form)
  while (index !== -1) {
    const before = text.slice(0, index)
    const after = text.slice(index + form.length)
    if (PATH_TOKEN_START.test(before) && end.test(after)) {
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
    .replace(COMPARABLE_NAMESPACE_UNC, "//")
    .replace(COMPARABLE_NAMESPACE, "")
    .replace(COMPARABLE_ADMIN_SHARE, (_share: string, drive: string) => `${drive}:`)
    .replace(/\/{2,}/g, "/")
    .replace(/(?<=.)\/$/, "")
}
