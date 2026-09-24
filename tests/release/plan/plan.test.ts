import { describe, expect, it } from "vitest"

import type { PlanInput, ReleasePlan, Step, StepId } from "#scripts"
import { buildPlan, NothingToRelease } from "#scripts"
import { CONFIG } from "../helpers.ts"

const input: PlanInput = {
  config: CONFIG,
  remote: "origin",
  currentVersion: "0.1.0",
  nextVersion: "0.2.0",
  releaseFiles: ["package.json", "package-lock.json", "CHANGELOG.md"],
}

function stepOf(plan: ReleasePlan, id: StepId): Step | undefined {
  return plan.steps.find((step) => step.id === id)
}

describe("buildPlan", () => {
  it("segue a ordem do Git Flow", () => {
    expect(buildPlan(input).steps.map((step) => step.id)).toEqual([
      "start",
      "version",
      "changelog",
      "commit",
      "finish",
      "checkout",
      "push",
    ])
  })

  it("termina na branch de integração, não na de produção", () => {
    expect(stepOf(buildPlan(input), "checkout")).toMatchObject({ kind: "run", args: ["checkout", "dev"] })
  })

  it("usa os prefixos do .gitflow na branch e na tag", () => {
    const plan = buildPlan(input)

    expect(plan.branch).toBe("release/0.2.0")
    expect(plan.tag).toBe("v0.2.0")
    expect(stepOf(plan, "start")).toMatchObject({ kind: "run", args: ["flow", "release", "start", "0.2.0"] })
  })

  it("commita só os arquivos do release", () => {
    expect(stepOf(buildPlan(input), "commit")).toMatchObject({
      kind: "run",
      args: ["commit", "-m", "chore(release): v0.2.0", "--", "package.json", "package-lock.json", "CHANGELOG.md"],
    })
  })

  it("fecha com a mensagem da tag e sem push automático", () => {
    expect(stepOf(buildPlan(input), "finish")).toMatchObject({
      kind: "run",
      args: ["flow", "release", "finish", "0.2.0", "--message", "v0.2.0", "--no-push"],
    })
  })

  it("envia main, dev e a tag de forma atômica", () => {
    expect(stepOf(buildPlan(input), "push")).toMatchObject({
      kind: "run",
      args: ["push", "--atomic", "origin", "main", "dev", "v0.2.0"],
    })
  })

  it("dá uma instrução de recuperação para cada passo", () => {
    for (const step of buildPlan(input).steps) expect(step.recovery.length).toBeGreaterThan(20)
  })

  it.each(["0.1.0", "0.0.9"])("recusa quando a próxima versão (%s) não é maior que a atual", (nextVersion) => {
    expect(() => buildPlan({ ...input, nextVersion })).toThrow(NothingToRelease)
  })

  it("recusa versões inválidas", () => {
    expect(() => buildPlan({ ...input, nextVersion: "0.2" })).toThrow(/versão inválida/)
  })
})
