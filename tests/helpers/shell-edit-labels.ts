import { ADVERSARIAL_SHELL_COMMANDS } from "./shell-edit-adversarial.ts"
import { ALLOWED_SHELL_COMMANDS } from "./shell-edit-allowed.ts"
import type { LabelledShellCommand } from "./shell-edit-label.ts"
import { REFUSED_SHELL_COMMANDS } from "./shell-edit-refused.ts"

export const LABELLED_SHELL_COMMANDS: LabelledShellCommand[] = [...REFUSED_SHELL_COMMANDS, ...ALLOWED_SHELL_COMMANDS]

export const MEASURED_SHELL_COMMANDS: LabelledShellCommand[] = [
  ...LABELLED_SHELL_COMMANDS,
  ...ADVERSARIAL_SHELL_COMMANDS,
]
