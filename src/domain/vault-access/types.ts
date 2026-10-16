export type PathAccessKind = "file" | "tree" | "listing"

export interface PathAccessRequest {
  kind: PathAccessKind
  path: string
}

export interface CommandAccessRequest {
  kind: "command"
  command: string
}

export type VaultAccessRequest = PathAccessRequest | CommandAccessRequest

export interface VaultForms {
  anywhere: string[]
  relative: string[]
}
