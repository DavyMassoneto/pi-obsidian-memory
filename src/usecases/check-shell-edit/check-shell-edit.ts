import {
  askShellEdit,
  defaultJevModel,
  executedFiles,
  firedQuestions,
  readExecutedScripts,
  SHELL_EDIT_CUTOFFS,
  shellEditRefusal,
  shellEditUncheckable,
} from "#src/services"
import type { CheckShellEditResult, ShellEditCommand, ShellEditDeps } from "./types.ts"

export async function checkShellEdit(input: ShellEditCommand, deps: ShellEditDeps): Promise<CheckShellEditResult> {
  const read = await readExecutedScripts(input.cwd, executedFiles(input.command))
  if (!read.succeeded) return refused(shellEditUncheckable(read.problems.join("; ")))
  const jev = await deps.jev(defaultJevModel)
  if (!jev.available) return refused(shellEditUncheckable(jev.reason))
  const state = { command: input.command, cwd: input.cwd, scripts: read.output.scripts, missing: read.output.missing }
  const asked = await askShellEdit({ classifier: jev.classifier, state, signal: deps.signal })
  if (!asked.succeeded) return refused(shellEditUncheckable(asked.problems.join("; ")))
  const [first, ...rest] = firedQuestions(asked.output.scores, SHELL_EDIT_CUTOFFS)
  if (first) return refused(shellEditRefusal([first, ...rest]))
  return { succeeded: true }
}

function refused(problem: string): CheckShellEditResult {
  return { succeeded: false, problems: [problem] }
}
