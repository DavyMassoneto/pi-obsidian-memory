import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { entryParts } from "./entry-parts.ts"
import { registerExtension } from "./extension.ts"
import { registrarFor } from "./registrar.ts"

export default function readOnlyExtension(pi: ExtensionAPI): void {
  registerExtension(registrarFor(pi), getAgentDir(), undefined, entryParts("read-only"))
}
