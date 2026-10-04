export interface Succeeded<Output> {
  succeeded: true
  output: Output
}

export interface Done {
  succeeded: true
}

export interface Failed {
  succeeded: false
  problems: string[]
}

export interface Absent {
  succeeded: false
}
