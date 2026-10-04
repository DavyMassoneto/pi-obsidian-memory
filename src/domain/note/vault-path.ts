export function joinVaultPath(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("/")
}
