import { createInterface } from "node:readline"
import type { Readable } from "node:stream"

export async function firstLineContaining(stream: Readable, text: string): Promise<string> {
  for await (const line of createInterface({ input: stream })) {
    if (line.includes(text)) {
      return line
    }
  }
  throw new Error(`stream ended without a line containing "${text}"`)
}
