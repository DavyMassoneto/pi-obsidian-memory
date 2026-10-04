export function joinVaultPath(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("/")
}

export function ancestorFolders(folder: string): string[] {
  const parts = folder.split("/").filter((part) => part.length > 0)
  const nested = parts.map((_part, depth) => parts.slice(0, parts.length - depth).join("/"))

  return [...nested, ""]
}
