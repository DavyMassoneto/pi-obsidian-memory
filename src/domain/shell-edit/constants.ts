import { NPM_VALUE_FLAGS } from "#src/domain/tool-flags"
import type { ShellEditQuestionName, ShellEditQuestions, ShellEditScores } from "./types.ts"

export const SCRIPT_EXTENSION = /\.(?:sh|ps1)$/i

export const LEADING_ENV_ASSIGNMENTS = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s"'])*\s+)+/

export const EXECUTABLE_SUFFIX = /\.exe$/

export const LAST_SEGMENT_START = /[^\\/]*$/

const EVAL_AND_PRINT_FLAGS = ["-e", "--eval", "-p", "--print"]

const PYTHON_INLINE_CODE_FLAGS = ["-c", "-m"]

const SHELL_INLINE_CODE_FLAGS = ["-c"]

export const INLINE_CODE_FLAGS = new Map([
  ["node", [...EVAL_AND_PRINT_FLAGS, "-c", "--check"]],
  ["tsx", EVAL_AND_PRINT_FLAGS],
  ["ts-node", EVAL_AND_PRINT_FLAGS],
  ["python", PYTHON_INLINE_CODE_FLAGS],
  ["python3", PYTHON_INLINE_CODE_FLAGS],
  ["py", PYTHON_INLINE_CODE_FLAGS],
  ["bash", SHELL_INLINE_CODE_FLAGS],
  ["sh", SHELL_INLINE_CODE_FLAGS],
])

export const BUN_INLINE_CODE_FLAGS = EVAL_AND_PRINT_FLAGS

export const CONFIG_FILE_FLAGS = ["-c", "--config"]

export const RUN_SUBCOMMAND = "run"

export const NO_FLAGS: string[] = []

export const PACKAGE_MANAGERS = new Map([
  ["npm", NPM_VALUE_FLAGS],
  ["pnpm", NO_FLAGS],
  ["yarn", NO_FLAGS],
])

export const BUN_SOURCE_FILE = /[\\/]|\.(?:[cm]?[jt]sx?|sh|ps1)$/i

export const PRELOAD_FLAGS = ["-r", "--require", "--import", "--preload", "--loader", "--experimental-loader"]

export const PACKAGE_RUN_COMMANDS = ["run", "run-script"]

export const PACKAGE_DIRECT_SCRIPTS = ["test", "start"]

export const SHELL_EDIT_QUESTION_NAMES: readonly ShellEditQuestionName[] = [
  "redirection",
  "in_place",
  "inline_code",
  "script_writes",
  "copy_download",
  "hardlink",
]

export const SHELL_EDIT_QUESTIONS: ShellEditQuestions = {
  redirection: {
    type: "bool",
    instructions:
      "Does `command` write output into a file through a redirection (`>` or `>>`) or a file-writing cmdlet (`tee`, `Out-File`, `Set-Content`, `Add-Content`)?",
    criteria: { true: "`command` sends output into a file", false: "`command` writes no output into any file" },
  },
  in_place: {
    type: "bool",
    instructions:
      "Does `command` change an existing file in place, for example with `sed -i`, `perl -pi`, or text read from a file, changed with `-replace` and written back to it, rather than through a linter, formatter, test runner, build, git or a package manager?",
    criteria: {
      true: "`command` rewrites an existing file in place",
      false: "`command` leaves existing files' contents as they are",
    },
  },
  inline_code: {
    type: "bool",
    instructions:
      "Does `command` carry inline code (`node -e`, `python -c`, a PowerShell `-Command` block or similar) whose code creates or writes a file?",
    criteria: {
      true: "the inline code in `command` creates or writes a file",
      false: "`command` has no inline code, or its inline code writes no file",
    },
  },
  script_writes: {
    type: "bool",
    instructions:
      "Does the code in any `scripts[*].text` create or write a file with its own code, rather than only launching a linter, formatter, test runner, build, git or a package manager?",
    criteria: {
      true: "a script's own code creates or writes a file",
      false: "no script's own code creates or writes a file",
    },
  },
  copy_download: {
    type: "bool",
    instructions:
      "Does `command` create a file by copying or downloading content (`cp`, `Copy-Item`, `curl -o`, `Invoke-WebRequest -OutFile`), other than through git or a package manager?",
    criteria: {
      true: "`command` creates a file by copying or downloading",
      false: "`command` copies and downloads no file",
    },
  },
  hardlink: {
    type: "bool",
    instructions:
      "Does `command` create a hardlink (`ln` without `-s`, `New-Item -ItemType HardLink`, `mklink /H`, `fsutil hardlink create`)?",
    criteria: { true: "`command` creates a hardlink", false: "`command` creates no hardlink" },
  },
}

export const SHELL_EDIT_CUTOFFS: ShellEditScores = {
  redirection: 0.5,
  in_place: 0.5,
  inline_code: 0.5,
  script_writes: 0.5,
  copy_download: 0.5,
  hardlink: 0.5,
}

export const SHELL_EDIT_REFUSED = "Refused by the shell-edit guard"

export const SHELL_EDIT_UNCHECKED = "Refused: the shell-edit guard could not check this command"

export const SHELL_EDIT_GUIDANCE =
  "The shell never creates or changes files: use the edit or write tool. Deleting, moving and renaming files, linters, formatters, git, npm and test runners stay allowed."
