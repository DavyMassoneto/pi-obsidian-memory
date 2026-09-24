import { Locale } from "typebox/system"

import { main } from "../index.ts"

Locale.Set(Locale.pt_BR)

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof Error)) throw error
  console.error(`✖ ${error.message}`)
  process.exitCode = 1
}
