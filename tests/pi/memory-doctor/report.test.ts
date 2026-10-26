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
      "- observer p/m: ok",
      "- memory agent p/m: ok",
      "- embeddings local/Xenova/multilingual-e5-small: ready",
      "- decision model typesafe/jev-latest: ready (model and API key found)",
      "- decision cutoffs: gate 0.5 (TypeSafe starting value), relevance 0.5 (TypeSafe starting value)",
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

test("the models section names the observer", () => {
  const report = renderDoctorReport(diagnosedMemory({}))

  expect(report).toContain("Models:\n- observer p/m: ok\n- memory agent p/m: ok")
  expect(report).not.toContain("capture")
})

test("a model that is not registered or has no credentials shows its problem", () => {
  const report = renderDoctorReport(
    diagnosedMemory({
      models: [
        {
          role: "observer",
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

  expect(report).toContain("- observer p/m: Model p/m is not registered in pi")
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

test("a decision model that answered says where, and a problem is named", () => {
  const answered = renderDoctorReport(
    diagnosedMemory({
      decision: {
        provider: "laya",
        model: "multilingual",
        status: "ready",
        detail: "answered at http://127.0.0.1:8000",
      },
    }),
  )
  const problem = renderDoctorReport(
    diagnosedMemory({
      decision: {
        provider: "typesafe",
        model: "jev-latest",
        status: "no-credentials",
        problem: "No API key for typesafe",
      },
    }),
  )

  expect(answered).toContain("- decision model laya/multilingual: ready (answered at http://127.0.0.1:8000)")
  expect(problem).toContain("- decision model typesafe/jev-latest: No API key for typesafe")
})
