export const VAULT_ACCESS_REFUSAL =
  "Vault files are reachable only through memory_search and memory_get, never with file tools or the shell."

export const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g

export const WINDOWS_SHELL_DRIVE_PREFIX = /^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/|$)/i

export const EXTENDED_LENGTH_UNC_PREFIX = /^\\\\\?\\UNC\\/i

export const EXTENDED_LENGTH_PREFIX = /^\\\\\?\\/

export const PATH_TOKEN_START = /(?:^|[\s=(,;|&<>])$/

export const PATH_TOKEN_END = /^(?:$|[\s/|;&)<>,]|\.(?:$|[\s/]))/

export const WINDOWS_DRIVE_START = /^[a-z]:\//

export const DRIVE_PATH_PREFIXES = ["/", "/mnt/", "/cygdrive/"]

export const PARENT_FOLDER_START = /^\.\.(\/|$)/

export const HOME_PREFIXES = [
  "~/",
  "$home/",
  "\u0024{home}/",
  "$env:home/",
  "%userprofile%/",
  "$env:userprofile/",
  "%homedrive%%homepath%/",
]
