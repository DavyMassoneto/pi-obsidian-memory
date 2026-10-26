import { writeFile } from "node:fs/promises"

import { expect, test } from "vitest"

import {
  DISCLOSURE_TITLE,
  JEV_DISCLOSURE,
  MEMORY_SETUP_COMMAND,
  REMOTE_EMBEDDINGS_DISCLOSURE,
  REPAIR_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_DONE,
  SETUP_KEEP_VAULT_TITLE,
} from "#src/pi"
import {
  agentModelStep,
  configuredWorld,
  DialogRequestSchema,
  modeStep,
  notifySettles,
  observerModelStep,
  pressEscape,
  recordsOf,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])
const LAYA = {
  provider: "laya",
  endpoint: "http://127.0.0.1:8000/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
}

test.each([
  { chosen: "Jev", settings: {}, shown: JEV_DISCLOSURE, hidden: REMOTE_EMBEDDINGS_DISCLOSURE },
  {
    chosen: "a remote embeddings provider",
    settings: { embeddings: { provider: "openai", model: "text-embedding-3-small" }, decisionModel: LAYA },
    shown: REMOTE_EMBEDDINGS_DISCLOSURE,
    hidden: JEV_DISCLOSURE,
  },
])("a repaired config that keeps $chosen shows its warning, and only its warning", async (kept) => {
  const world = await configuredWorld({})
  const config = await storedConfig(world)
  await writeFile(
    world.folders.configPath,
    JSON.stringify({ ...config, ...kept.settings, limits: { maxBodyChars: -1 } }),
  )
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "confirm", title: REPAIR_TITLE, answer: { confirmed: true } },
      observerModelStep(pressEscape),
      agentModelStep(pressEscape),
      modeStep({ option: SETUP_ATTACH_OPTION }),
      vaultStep(SETUP_KEEP_VAULT_TITLE, { value: "" }),
    ],
    settles,
  )
  const warning = turn.notifications.find((notice) => notice.message.startsWith(DISCLOSURE_TITLE))
  expect(warning?.notifyType).toBe("warning")
  expect(warning?.message).toContain(kept.shown)
  expect(warning?.message).not.toContain(kept.hidden)
  expect(recordsOf(DialogRequestSchema, world.pi.lines).filter((dialog) => dialog.method === "confirm")).toHaveLength(1)
  expect(world.pi.unexpected).toEqual([])
})
