import { commandSegments } from "./command-segments.ts"
import { commandWords } from "./command-words.ts"
import {
  BUN_INLINE_CODE_FLAGS,
  CONFIG_FILE_FLAGS,
  EXECUTABLE_SUFFIX,
  INLINE_CODE_FLAGS,
  LAST_SEGMENT_START,
  LEADING_ENV_ASSIGNMENTS,
  PACKAGE_DIRECT_SCRIPTS,
  PACKAGE_MANAGERS,
  PACKAGE_RUN_COMMANDS,
  POWERSHELL_FILE_FLAGS,
  POWERSHELL_PROGRAMS,
  PRELOAD_FLAGS,
  RUN_SUBCOMMAND,
  SCRIPT_EXTENSION,
} from "./constants.ts"
import type { ExecutedFile } from "./types.ts"

export function executedFiles(command: string): ExecutedFile[] {
  const found = new Map<string, ExecutedFile>()
  for (const segment of commandSegments(command)) {
    for (const file of segmentFiles(segment)) found.set(JSON.stringify(file), file)
  }
  return [...found.values()]
}

function segmentFiles(segment: string): ExecutedFile[] {
  const [first, ...args] = commandWords(segment.replace(LEADING_ENV_ASSIGNMENTS, ""))
  if (typeof first !== "string") return []
  const program = programName(first)
  const inlineCodeFlags = INLINE_CODE_FLAGS.get(program)
  if (inlineCodeFlags) return interpreterFiles(args, inlineCodeFlags, [])
  if (program === "bun") return interpreterFiles(withoutRun(args), BUN_INLINE_CODE_FLAGS, CONFIG_FILE_FLAGS)
  if (program === "deno") return denoFiles(args)
  if (POWERSHELL_PROGRAMS.includes(program)) return powershellFiles(args)
  if (PACKAGE_MANAGERS.includes(program)) return packageScripts(args)
  if (SCRIPT_EXTENSION.test(first)) return [{ kind: "script", path: first }]
  return []
}

function programName(token: string): string {
  const name = token.slice(token.search(LAST_SEGMENT_START))
  return name.toLowerCase().replace(EXECUTABLE_SUFFIX, "")
}

function withoutRun(args: string[]): string[] {
  if (args[0] === RUN_SUBCOMMAND) return args.slice(1)
  return args
}

function denoFiles(args: string[]): ExecutedFile[] {
  if (args[0] !== RUN_SUBCOMMAND) return []
  return interpreterFiles(args.slice(1), [], CONFIG_FILE_FLAGS)
}

function interpreterFiles(args: string[], inlineCodeFlags: string[], flagsWithValue: string[]): ExecutedFile[] {
  const files: ExecutedFile[] = []
  let index = 0
  for (let arg = args[index]; typeof arg === "string"; arg = args[index]) {
    if (inlineCodeFlags.includes(arg)) return files
    if (PRELOAD_FLAGS.includes(arg)) {
      const preload = args[index + 1]
      if (typeof preload === "string") files.push({ kind: "script", path: preload })
      index += 2
    } else if (flagsWithValue.includes(arg)) {
      index += 2
    } else if (arg.startsWith("-")) {
      index += 1
    } else {
      return [...files, { kind: "script", path: arg }]
    }
  }
  return files
}

function powershellFiles(args: string[]): ExecutedFile[] {
  const flag = args.findIndex((arg) => POWERSHELL_FILE_FLAGS.includes(arg.toLowerCase()))
  const path = args[flag + 1]
  if (flag < 0 || typeof path !== "string") return []
  return [{ kind: "script", path }]
}

function packageScripts(args: string[]): ExecutedFile[] {
  const words = args.filter((arg) => !arg.startsWith("-"))
  const [first, second] = words
  if (typeof first !== "string") return []
  if (PACKAGE_DIRECT_SCRIPTS.includes(first)) return [{ kind: "package-script", name: first }]
  if (PACKAGE_RUN_COMMANDS.includes(first) && typeof second === "string") {
    return [{ kind: "package-script", name: second }]
  }
  return []
}
