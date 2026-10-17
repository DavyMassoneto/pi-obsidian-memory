import { BUN_FOLDER_FLAGS, BUN_VALUE_FLAGS, INTERPRETER_VALUE_FLAGS } from "#src/domain/command-flags"
import { NPM_PREFIX_FLAGS, NPM_WORKSPACE_FLAGS, POWERSHELL_PARAMETERS } from "#src/domain/tool-flags"
import { commandSegments } from "./command-segments.ts"
import { commandWords } from "./command-words.ts"
import {
  BUN_INLINE_CODE_FLAGS,
  BUN_SOURCE_FILE,
  CONFIG_FILE_FLAGS,
  EXECUTABLE_SUFFIX,
  INLINE_CODE_FLAGS,
  LAST_SEGMENT_START,
  LEADING_ENV_ASSIGNMENTS,
  NO_FLAGS,
  PACKAGE_DIRECT_SCRIPTS,
  PACKAGE_MANAGERS,
  PACKAGE_RUN_COMMANDS,
  PRELOAD_FLAGS,
  RUN_SUBCOMMAND,
  SCRIPT_EXTENSION,
} from "./constants.ts"
import { powershellFiles, scriptFile } from "./powershell-files.ts"
import type { ExecutedFile, FolderRead, InterpreterRules } from "./types.ts"

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
  const inlineCode = INLINE_CODE_FLAGS.get(program)
  const withValue = INTERPRETER_VALUE_FLAGS.get(program)
  if (inlineCode && withValue) {
    return interpreterFiles(args, { inlineCode, withValue, folderFlags: NO_FLAGS, mainFile: scriptFile })
  }
  if (program === "bun") return bunFiles(args)
  if (program === "deno") return denoFiles(args)
  const powershellParameters = POWERSHELL_PARAMETERS.get(program)
  if (powershellParameters) return powershellFiles(args, powershellParameters)
  const packageFlags = PACKAGE_MANAGERS.get(program)
  if (packageFlags) return packageScripts(args, packageFlags)
  if (SCRIPT_EXTENSION.test(first)) return [scriptFile(first)]
  return []
}

function programName(token: string): string {
  const name = token.slice(token.search(LAST_SEGMENT_START))
  return name.toLowerCase().replace(EXECUTABLE_SUFFIX, "")
}

function packageScript(name: string, prefix: string): ExecutedFile {
  return { kind: "package-script", name, prefix }
}

function bunRunTarget(name: string, folder: string): ExecutedFile {
  if (BUN_SOURCE_FILE.test(name)) return scriptFile(name)
  return packageScript(name, folder)
}

function bunFiles(args: string[]): ExecutedFile[] {
  const rules = {
    inlineCode: BUN_INLINE_CODE_FLAGS,
    withValue: BUN_VALUE_FLAGS,
    folderFlags: BUN_FOLDER_FLAGS,
    mainFile: scriptFile,
  }
  if (args[0] === RUN_SUBCOMMAND) return interpreterFiles(args.slice(1), { ...rules, mainFile: bunRunTarget })
  return interpreterFiles(args, rules)
}

function denoFiles(args: string[]): ExecutedFile[] {
  if (args[0] !== RUN_SUBCOMMAND) return []
  const rules = { inlineCode: NO_FLAGS, withValue: CONFIG_FILE_FLAGS, folderFlags: NO_FLAGS, mainFile: scriptFile }
  return interpreterFiles(args.slice(1), rules)
}

function assignedValue(arg: string, flags: string[]): string {
  const equals = arg.indexOf("=")
  if (equals < 0 || !flags.includes(arg.slice(0, equals))) return ""
  return arg.slice(equals + 1)
}

function isAssignment(arg: string, flags: string[]): boolean {
  return assignedValue(arg, flags) !== ""
}

function folderRead(args: string[], index: number, flags: string[]): FolderRead {
  const arg = args[index]
  const next = args[index + 1]
  if (typeof arg !== "string") return { folder: "", width: 0 }
  if (flags.includes(arg) && typeof next === "string") return { folder: next, width: 2 }
  if (isAssignment(arg, flags)) return { folder: assignedValue(arg, flags), width: 1 }
  return { folder: "", width: 0 }
}

function interpreterFiles(args: string[], rules: InterpreterRules): ExecutedFile[] {
  const files: ExecutedFile[] = []
  let folder = ""
  let index = 0
  for (let arg = args[index]; typeof arg === "string"; arg = args[index]) {
    const next = args[index + 1]
    const read = folderRead(args, index, rules.folderFlags)
    if (rules.inlineCode.includes(arg)) return files
    if (read.width > 0) {
      folder = read.folder
      index += read.width
    } else if (rules.withValue.includes(arg)) {
      index += 2
    } else if (PRELOAD_FLAGS.includes(arg)) {
      if (typeof next === "string") files.push(scriptFile(next))
      index += 2
    } else if (arg.startsWith("-")) {
      index += 1
    } else {
      return [...files, rules.mainFile(arg, folder)]
    }
  }
  return files
}

function packageScriptOf(words: string[], prefix: string): ExecutedFile[] {
  const [first, second] = words
  if (typeof first !== "string") return []
  if (PACKAGE_DIRECT_SCRIPTS.includes(first)) return [packageScript(first, prefix)]
  if (PACKAGE_RUN_COMMANDS.includes(first) && typeof second === "string") return [packageScript(second, prefix)]
  return []
}

function packageScripts(args: string[], valueFlags: string[]): ExecutedFile[] {
  const prefixFlags = NPM_PREFIX_FLAGS.filter((flag) => valueFlags.includes(flag))
  const workspaceFlags = NPM_WORKSPACE_FLAGS.filter((flag) => valueFlags.includes(flag))
  const words: string[] = []
  let prefix = ""
  let index = 0
  for (let arg = args[index]; typeof arg === "string" && arg !== "--"; arg = args[index]) {
    const read = folderRead(args, index, prefixFlags)
    if (workspaceFlags.includes(arg) || isAssignment(arg, workspaceFlags)) return []
    if (read.width > 0) {
      prefix = read.folder
      index += read.width
    } else if (valueFlags.includes(arg)) {
      index += 2
    } else {
      if (!arg.startsWith("-")) words.push(arg)
      index += 1
    }
  }
  return packageScriptOf(words, prefix)
}
