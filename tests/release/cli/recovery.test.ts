import { describe, expect, it } from "vitest"

import { buildPlan, formatFailure } from "#scripts"
import { CONFIG } from "../helpers.ts"

describe("formatFailure", () => {
  it("mostra o que já foi feito, o erro e como seguir", () => {
    const plan = buildPlan({
      config: CONFIG,
      remote: "origin",
      currentVersion: "0.1.0",
      nextVersion: "0.2.0",
      releaseFiles: ["package.json"],
    })
    const [start, version, changelog] = plan.steps
    if (!start || !version || !changelog) throw new Error("plano incompleto")

    const text = formatFailure(changelog, [start, version], new Error("disco cheio"))

    expect(text).toContain("Falhou em: Gerar o CHANGELOG.md")
    expect(text).toContain("disco cheio")
    expect(text).toContain(`✔ ${start.title}`)
    expect(text).toContain(`✔ ${version.title}`)
    expect(text).toContain("git flow release delete --force 0.2.0")
  })
})
