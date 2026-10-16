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
          notes: [
            {
              vault: "global",
              path: "Long.md",
              type: "rule",
              id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
              hash: "a".repeat(64),
              statement: "Long",
              body: "Too long.",
              problems: ["body: too long"],
            },
          ],
          problems: [],
        },
      ],
    },
  })

  expect(block).toContain("### global · Long.md · rule\nToo long.\nNeeds fixing:\n- body: too long")
})

test("a refusal because there is no config gives no block", () => {
  expect(renderMemoryBlock({ succeeded: false, reason: "not-configured", problems: ["p"], configPath: "c" })).toBeNull()
})

test.each(["invalid-config", "config-unavailable"] as const)(
  "a %s refusal gives a block that names the tools and the problem",
  (reason) => {
    const block = renderMemoryBlock({ succeeded: false, reason, problems: ["p"], configPath: "c" })

    expect(block).toContain("memory_search")
    expect(block).toContain("Could not load Don't forget notes: p")
  },
)

test("a failed load renders the intro and the failure", () => {
  const block = renderLoadFailure("disk exploded")

  expect(block).toContain("only part of your long-term memory")
  expect(block).toContain("Could not load Don't forget notes: disk exploded")
})
