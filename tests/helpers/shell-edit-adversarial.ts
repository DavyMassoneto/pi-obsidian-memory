import type { LabelledShellCommand } from "./shell-edit-label.ts"

export const ADVERSARIAL_SHELL_COMMANDS: LabelledShellCommand[] = [
  {
    shell: "bash",
    command: "node claims-read.js",
    expected: "script_writes",
    creates: ["adv-read.txt"],
    removes: [],
  },
  {
    shell: "powershell",
    command: "node .\\answer-no.js",
    expected: "script_writes",
    creates: ["adv-no.txt"],
    removes: [],
  },
  {
    shell: "bash",
    command: "python claims-lint.py",
    expected: "script_writes",
    creates: ["adv-lint.txt"],
    removes: [],
  },
]
