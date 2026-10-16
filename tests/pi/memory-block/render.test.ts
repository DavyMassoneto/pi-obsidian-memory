import { expect, test } from "vitest"

import { renderLoadFailure, renderMemoryBlock } from "#src/pi"

test("an unreadable vault is reported in the block and the other vault still loads", () => {
  const block = renderMemoryBlock({
    succeeded: true,
    output: {
      vaults: [
        { vault: "global", notes: [], problems: [] },
        { vault: "project", notes: [], problems: ["not found: vault is missing"] },
      ],
    },
  })

  expect(block).toContain("Could not load the project vault: not found: vault is missing")
})

test("a note with problems carries them under Needs fixing", () => {
  const block = renderMemoryBlock({
    succeeded: true,
    output: {
      vaults: [
        {
          vault: "global",
          notes: [{ vault: "global", path: "Long.md", type: "rule", body: "Too long.", problems: ["body: too long"] }],
          problems: [],
        },
      ],
    },
  })

  expect(block).toContain("### global · Long.md · rule\nToo long.\nNeeds fixing:\n- body: too long")
})

test.each(["not-configured", "invalid-config", "config-unavailable"] as const)(
  "a %s refusal gives no block",
  (reason) => {
    expect(renderMemoryBlock({ succeeded: false, reason, problems: ["p"], configPath: "c" })).toBeNull()
  },
)

test("a failed load renders the intro and the failure", () => {
  const block = renderLoadFailure("disk exploded")

  expect(block).toContain("only part of your long-term memory")
  expect(block).toContain("Could not load Don't forget notes: disk exploded")
})
