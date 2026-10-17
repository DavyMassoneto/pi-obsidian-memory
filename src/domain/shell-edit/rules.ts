import {
  SHELL_EDIT_GUIDANCE,
  SHELL_EDIT_QUESTION_NAMES,
  SHELL_EDIT_REFUSED,
  SHELL_EDIT_UNCHECKED,
} from "./constants.ts"
import type { ShellEditQuestionName, ShellEditScores } from "./types.ts"

export function firedQuestions(scores: ShellEditScores, cutoffs: ShellEditScores): ShellEditQuestionName[] {
  return SHELL_EDIT_QUESTION_NAMES.filter((name) => scores[name] >= cutoffs[name])
}

export function shellEditRefusal(fired: [ShellEditQuestionName, ...ShellEditQuestionName[]]): string {
  return `${SHELL_EDIT_REFUSED} (${fired.join(", ")}). ${SHELL_EDIT_GUIDANCE}`
}

export function shellEditUncheckable(cause: string): string {
  return `${SHELL_EDIT_UNCHECKED}: ${cause.replace(/\.$/, "")}. ${SHELL_EDIT_GUIDANCE}`
}
