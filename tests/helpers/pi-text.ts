import type { MemoryAddResponse } from "#src/pi"

export function textOf(response: MemoryAddResponse): string {
  const texts = response.content.flatMap((part) => {
    if (part.type === "text") {
      return [part.text]
    }

    return []
  })

  return texts.join("")
}

export function mentionsIn(texts: string[]): string[] {
  return texts.flatMap((text) =>
    [
      ...text.matchAll(/(?<=^|[\s`(])\/[a-z][\w-]*/g),
      ...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g),
      ...text.matchAll(/(?<![\w/])memory-\w+/g),
    ].map((mention) => mention[0]),
  )
}

export function unregisteredMentions(texts: string[], registered: string[]): string[] {
  return mentionsIn(texts).filter((mention) => !registered.includes(mention))
}

export const PI_BUILTIN_COMMANDS = ["/reload"]
