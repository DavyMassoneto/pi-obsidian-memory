export function omLoaded(commandNames: string[]): boolean {
  return commandNames.some((name) => name === "om" || name.startsWith("om:"))
}
