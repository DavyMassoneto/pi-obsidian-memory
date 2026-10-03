import { expect, test } from "vitest"

import { firstLineContaining, withIsolatedPi } from "#test-helpers"

const loadedMessage = "pi-obsidian-memory loaded"

test("pi loads the extension from the package", async () => {
  await withIsolatedPi(async (pi) => {
    const line = await firstLineContaining(pi.stdout, loadedMessage)
    expect(JSON.parse(line)).toMatchObject({
      type: "extension_ui_request",
      method: "notify",
      message: loadedMessage,
      notifyType: "info",
    })
  })
})
