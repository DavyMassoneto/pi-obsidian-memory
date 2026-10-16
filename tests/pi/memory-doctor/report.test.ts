import { expect, test } from "vitest"

import { renderDoctorReport } from "#src/pi"
import { diagnosedMemory } from "#test-helpers"

test("a clean vault says no problems were found, and the providers not in use yet say so", () => {
  expect(renderDoctorReport(diagnosedMemory({}))).toBe(
    [
      "Memory doctor",
      "",
      "Global vault: no problems found.",
      "",
      "Models:",
      "- capture p/m: ok",
      "- memory agent p/m: ok",
      "- embeddings local/Xenova/multilingual-e5-small: ready",
      "- decision model: not used yet",
    ].join("\n"),
  )
})

test("every kind of problem is listed under its own heading with its paths", () => {
  const report = renderDoctorReport(
    diagnosedMemory({
      vaults: [
        {
          vault: "project",
          diagnosis: {
            invalid: [{ path: "tools/Broken.md", problems: ["frontmatter: unknown field colour", "body: too long"] }],
            blank: ["Blank.md"],
            duplicateIds: [{ id: "01JABC", paths: ["a.md", "b.md"] }],
            temporaries: ["tools/Half.md.tmp-abc"],
            crowdedFolders: [{ folder: "crowded", count: 21 }],
          },
          blanks: [],
          unreadable: ["tools/Locked.md: EBUSY"],
        },
      ],
    }),
  )

  expect(report).toContain("Project vault:")
  expect(report).toContain("Invalid notes:\n- tools/Broken.md: frontmatter: unknown field colour; body: too long")
  expect(report).toContain("Copied ids:\n- 01JABC: a.md, b.md")
  expect(report).toContain("Blank notes (no frontmatter):\n- Blank.md")
  expect(report).toContain("Leftover temporary files:\n- tools/Half.md.tmp-abc")
  expect(report).toContain("Folders above 20 notes (consider splitting them):\n- crowded: 21 notes")
  expect(report).toContain("Files that could not be read:\n- tools/Locked.md: EBUSY")
  expect(report).not.toContain("no problems found")
})

test("a vault that could not be checked says why", () => {
  const report = renderDoctorReport(diagnosedMemory({ vaults: [{ vault: "project", problems: ["vault is missing"] }] }))

  expect(report).toContain("Project vault: could not be checked.\n- vault is missing")
})

test("a folder with no registered project says so", () => {
  expect(renderDoctorReport(diagnosedMemory({ projectMissing: true }))).toContain(
    "No project vault is registered for this folder.",
  )
})

test("a model that is not registered or has no credentials shows its problem", () => {
  const report = renderDoctorReport(
    diagnosedMemory({
      models: [
        {
          role: "capture",
          check: {
            model: { provider: "p", id: "m" },
            status: "model-not-found",
            problem: "Model p/m is not registered in pi",
          },
        },
        {
          role: "memory agent",
          check: { model: { provider: "q", id: "n" }, status: "no-credentials", problem: "No API key" },
        },
      ],
    }),
  )

  expect(report).toContain("- capture p/m: Model p/m is not registered in pi")
  expect(report).toContain("- memory agent q/n: No API key")
})

test("an embeddings provider that is not ready shows its problem", () => {
  const report = renderDoctorReport(
    diagnosedMemory({
      embeddings: {
        provider: "openai",
        model: "text-embedding-3-small",
        status: "no-credentials",
        problem: "No API key for openai",
      },
    }),
  )

  expect(report).toContain("- embeddings openai/text-embedding-3-small: No API key for openai")
})
