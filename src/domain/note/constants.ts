export const FRONTMATTER_FENCE = "---"

export const LINE_BREAK = "\n"

export const REPEATED_FIELD_ERROR_CODE = "DUPLICATE_KEY"

export const KNOWN_FRONTMATTER_FIELDS = [
  "id",
  "type",
  "created",
  "updated",
  "dontForget",
  "archived",
  "replaces",
  "replacedBy",
]

export const NOT_FIELDS_PROBLEM = "frontmatter: must be fields (name: value)"

export const NAME_NOT_TEXT_PROBLEM = "frontmatter: a field name is not text"

export const FOLDER_INDEX_NAME = "index"

export const ARCHIVE_FOLDER = "archive"

export const TEMPLATES_FOLDER = "_templates"

export const RESERVED_ROOT_FOLDERS = [ARCHIVE_FOLDER, TEMPLATES_FOLDER]

export const VAULT_PATH_SEPARATOR = "/"

export const DRIVE_LETTER = /^[A-Za-z]:/

export const RELATIVE_NAMES = [".", ".."]

export const HIDDEN_NAME_PREFIX = "."

export const CHARACTERS_WINDOWS_FORBIDS_IN_FILE_NAMES = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]

export const CHARACTERS_THAT_BREAK_OBSIDIAN_LINKS = ["[", "]", "#", "^"]

export const FIRST_PRINTABLE_CHARACTER_CODE = 32

export const WINDOWS_RESERVED_NAMES = [
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]
