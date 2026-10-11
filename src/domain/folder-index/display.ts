export function displayIndexText(text: string): string {
  if (/[<>[\]`]/.test(text)) {
    return displayIndexName(text)
  }

  return text
}

export function displayIndexName(name: string): string {
  if (name.length === 0) {
    return "<code></code>"
  }

  const runs = [...name.matchAll(/`+/g)].map((match) => match[0].length)
  const fence = "`".repeat(Math.max(0, ...runs) + 1)
  const mixedEdgeSpaces = name.startsWith(" ") && name.endsWith(" ") && /[^ ]/.test(name)
  if (name.startsWith("`") || name.endsWith("`") || mixedEdgeSpaces) {
    return `${fence} ${name} ${fence}`
  }

  return `${fence}${name}${fence}`
}
