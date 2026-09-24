import { Locale } from "typebox/system"

import { main } from "../index.ts"

Locale.Set(Locale.pt_BR)

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
