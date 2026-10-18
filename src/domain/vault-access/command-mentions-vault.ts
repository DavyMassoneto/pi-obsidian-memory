import { isInside } from "#src/domain/config"
import { type PathPlatform, pathModule } from "#src/domain/path-platform"
import { argumentTokens } from "./argument-tokens.ts"
import {
  COMPARABLE_ADMIN_SHARE,
  COMPARABLE_NAMESPACE,
  COMPARABLE_NAMESPACE_UNC,
  DRIVE_PATH_PREFIXES,
  FILE_URL_PREFIX,
  HOME_PREFIXES,
  PARENT_FOLDER_START,
  PATH_FOLLOWS,
  PATH_TOKEN_END,
  PATH_TOKEN_START,
  WINDOWS_DRIVE_START,
  WINDOWS_FILE_URL_PREFIX,
} from "./constants.ts"
import type { VaultForms } from "./types.ts"

export function commandMentionsVault(
  command: string,
  cwd: string,
  home: string,
  vaults: string[],
  platform: PathPlatform,
): string | null {
  const text = comparableText(command, platform)
  const tokens = argumentTokens(command).map((token) => comparableText(token, platform).replace(/(?<=.)\.+$/, ""))
  for (const vault of vaults) {
    if (isInside(cwd, vault) || mentionsForms(text, tokens, vaultForms(vault, cwd, home, platform))) {
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

function vaultForms(vault: string, cwd: string, home: string, platform: PathPlatform): VaultForms {
  const absolute = comparableText(vault, platform)
  const shellDriveForms = DRIVE_PATH_PREFIXES.flatMap((prefix) => shellDriveForm(absolute, prefix))
  const downFromHome = relativeTo(home, vault, platform).filter((path) => !PARENT_FOLDER_START.test(path))
  const homeForms = downFromHome.flatMap((path) => HOME_PREFIXES.map((prefix) => `${prefix}${path}`))
  const fromCwd = relativeTo(cwd, vault, platform)
  const dotSlashForms = fromCwd.filter((path) => !PARENT_FOLDER_START.test(path)).map((path) => `./${path}`)

  return { anywhere: [absolute, ...shellDriveForms, ...homeForms], relative: [...fromCwd, ...dotSlashForms] }
}

function shellDriveForm(absolute: string, prefix: string): string[] {
  if (!WINDOWS_DRIVE_START.test(absolute)) {
    return []
  }

  return [`${prefix}${absolute[0]}${absolute.slice(2)}`]
}

function relativeTo(base: string, vault: string, platform: PathPlatform): string[] {
  const path = pathModule(platform)
  const relative = comparableText(path.relative(base, vault), platform)
  if (relative === "" || path.isAbsolute(relative)) {
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

function withoutFileUrl(text: string, platform: PathPlatform): string {
  if (platform === "win32") {
    return text.replace(WINDOWS_FILE_URL_PREFIX, "")
  }

  return text.replace(FILE_URL_PREFIX, "")
}

function comparableText(text: string, platform: PathPlatform): string {
  return withoutFileUrl(text, platform)
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/["'`]/g, "")
    .replace(COMPARABLE_NAMESPACE_UNC, "//")
    .replace(COMPARABLE_NAMESPACE, "")
    .replace(COMPARABLE_ADMIN_SHARE, (_share: string, drive: string) => `${drive}:`)
    .replace(/\/{2,}/g, "/")
    .replace(/(?<=.)\/$/, "")
}
