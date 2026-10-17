export interface ScriptFile {
  kind: "script"
  path: string
}

export interface PackageScript {
  kind: "package-script"
  name: string
}

export type ExecutedFile = ScriptFile | PackageScript

export type ShellEditQuestionName =
  | "redirection"
  | "in_place"
  | "inline_code"
  | "script_writes"
  | "copy_download"
  | "hardlink"

export interface ShellEditCriteria {
  true: string
  false: string
}

export interface ShellEditQuestion {
  type: "bool"
  instructions: string
  criteria: ShellEditCriteria
}

export interface ShellEditQuestions {
  redirection: ShellEditQuestion
  in_place: ShellEditQuestion
  inline_code: ShellEditQuestion
  script_writes: ShellEditQuestion
  copy_download: ShellEditQuestion
  hardlink: ShellEditQuestion
}

export interface ShellEditScores {
  redirection: number
  in_place: number
  inline_code: number
  script_writes: number
  copy_download: number
  hardlink: number
}

export interface ShellEditScript {
  path: string
  text: string
}

export interface ShellEditState {
  command: string
  cwd: string
  scripts: ShellEditScript[]
  missing: string[]
}
