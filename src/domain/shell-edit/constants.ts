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

export const POWERSHELL_PROGRAMS = ["pwsh", "powershell"]

export const POWERSHELL_FILE_FLAGS = ["-file", "-f"]

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn"]

export const PRELOAD_FLAGS = ["-r", "--require", "--import"]

export const PACKAGE_RUN_COMMANDS = ["run", "run-script"]

export const PACKAGE_DIRECT_SCRIPTS = ["test", "start"]
