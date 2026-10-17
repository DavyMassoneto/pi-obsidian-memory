import type { ShellEditQuestionName } from "#src/domain"

export interface LabelledShellCommand {
  shell: "bash" | "powershell"
  command: string
  expected: ShellEditQuestionName | "allow"
  creates: string[]
  removes: string[]
  output?: string
}
