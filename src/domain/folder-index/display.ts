export function displayIndexText(text: string): string {
  if (/[<>[\]`]/.test(text)) {
    return displayIndexName(text)
  }

  return text
}

export function displayIndexName(name: string): string {
  const runs = [...name.matchAll(/`+/g)].map((match) => match[0].length)
  const fence = "`".repeat(Math.max(0, ...runs) + 1)
  if (name.startsWith("`") || name.endsWith("`") || (name.startsWith(" ") && name.endsWith(" "))) {
    return `${fence} ${name} ${fence}`
  }

  return `${fence}${name}${fence}`
}
