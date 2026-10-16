import { expect, test } from "vitest"

import { describeRegistered, describeRegistrationFailure } from "#src/pi"

const noAssets = { createdRoot: false, created: [], preserved: [], maintenanceProblems: [] }

test("a registration with a new vault lists what was created, kept and warned about", () => {
  const text = describeRegistered("Done.", {
    configHash: "hash",
    assets: {
      createdRoot: true,
      created: ["Memory.base", "_templates/rule.md"],
      preserved: ["_templates/fact.md"],
      maintenanceProblems: [],
    },
    warnings: ["index is stale"],
  })

  expect(text).toBe(
    [
      "Done.",
      "Vault folder created.",
      "Created: Memory.base, _templates/rule.md",
      "Kept as they were: _templates/fact.md",
      "Warnings:",
      "- index is stale",
    ].join("\n"),
  )
})

test("a registration with nothing to report says only the headline", () => {
  expect(describeRegistered("Done.", { configHash: "hash", assets: noAssets, warnings: [] })).toBe("Done.")
})

test.each([
  ["validation", []],
  ["bootstrap", ["Stopped while preparing the vault; the config was not written."]],
  ["config", ["The vault is ready but the config was not written."]],
] as const)("a %s failure lists every problem and the stage line", (stage, stageLines) => {
  const problems = ["first problem", "second problem"]

  const text = describeRegistrationFailure({
    succeeded: false,
    stage,
    assets: noAssets,
    cause: { succeeded: false, problems },
    problems,
  })

  expect(text).toBe(["Not changed. Problems:", "- first problem", "- second problem", ...stageLines].join("\n"))
})
