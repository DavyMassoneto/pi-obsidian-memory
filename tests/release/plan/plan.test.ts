import { describe, expect, it } from "vitest"

import { NothingToRelease } from "../../../scripts/release/plan/errors.ts"
import { buildPlan } from "../../../scripts/release/plan/plan.ts"
import type { PlanInput, ReleasePlan, StepId } from "../../../scripts/release/plan/types.ts"
import { CONFIG } from "../helpers.ts"

const input: PlanInput = {
  config: CONFIG,
  remote: "origin",
  currentVersion: "0.1.0",
  nextVersion: "0.2.0",
  releaseFiles: ["package.json", "package-lock.json", "CHANGELOG.md"],
}

function argsOf(plan: ReleasePlan, id: StepId): readonly string[] {
  const step = plan.steps.find((candidate) => candidate.id === id)
  if (step?.kind !== "run") throw new Error(`passo ${id} não é um comando`)
  return step.args
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
    expect(argsOf(buildPlan(input), "checkout")).toEqual(["checkout", "dev"])
  })

  it("usa os prefixos do .gitflow na branch e na tag", () => {
    const plan = buildPlan(input)

    expect(plan.branch).toBe("release/0.2.0")
    expect(plan.tag).toBe("v0.2.0")
    expect(argsOf(plan, "start")).toEqual(["flow", "release", "start", "0.2.0"])
  })

  it("commita só os arquivos do release", () => {
    expect(argsOf(buildPlan(input), "commit")).toEqual([
      "commit",
      "-m",
      "chore(release): v0.2.0",
      "--",
      "package.json",
      "package-lock.json",
      "CHANGELOG.md",
    ])
  })

  it("fecha com a mensagem da tag e sem push automático", () => {
    expect(argsOf(buildPlan(input), "finish")).toEqual([
      "flow",
      "release",
      "finish",
      "0.2.0",
      "--message",
      "v0.2.0",
      "--no-push",
    ])
  })

  it("envia main, dev e a tag de forma atômica", () => {
    expect(argsOf(buildPlan(input), "push")).toEqual(["push", "--atomic", "origin", "main", "dev", "v0.2.0"])
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
