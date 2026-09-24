import { describe, expect, it } from "vitest"

import { formatFailure, type Step } from "#scripts"

const start: Step = {
  id: "start",
  kind: "run",
  title: "Abrir release/0.2.0 a partir da dev",
  command: "git",
  args: ["flow", "release", "start", "0.2.0"],
  recovery: "Nada mudou nas branches principais.",
}

const version: Step = {
  id: "version",
  kind: "set-version",
  title: "Versão 0.2.0 no package.json",
  version: "0.2.0",
  recovery: "Corrija o problema e continue à mão.",
}

const changelog: Step = {
  id: "changelog",
  kind: "changelog",
  title: "Gerar o CHANGELOG.md",
  tag: "v0.2.0",
  recovery: "Abandone o release: git flow release delete --force 0.2.0",
}

describe("formatFailure", () => {
  it("mostra o que já foi feito, o erro e como seguir", () => {
    const text = formatFailure(changelog, [start, version], new Error("disco cheio"))

    expect(text).toContain("Falhou em: Gerar o CHANGELOG.md")
    expect(text).toContain("disco cheio")
    expect(text).toContain(`✔ ${start.title}`)
    expect(text).toContain(`✔ ${version.title}`)
    expect(text).toContain("git flow release delete --force 0.2.0")
  })

  it("não lista passos feitos quando a falha é no primeiro", () => {
    expect(formatFailure(start, [], new Error("sem rede"))).not.toContain("Já feito")
  })
})
