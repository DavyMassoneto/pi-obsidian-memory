import { existsSync } from "node:fs"
import { join } from "node:path"
import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { parseArgs } from "node:util"

import {
  type Bump,
  buildPlan,
  bumpedVersion,
  type GitFlowConfig,
  isBump,
  previewChangelog,
  type ReleasePlan,
  readGitFlowConfig,
  readPackageVersion,
  runPreflight,
  runVisible,
  type Step,
  setPackageVersion,
  writeChangelog,
} from "../index.ts"
import { RELEASE_FILES, REMOTE, USAGE } from "./constants.ts"
import { formatFailure } from "./recovery.ts"
import type { ReleaseOptions } from "./types.ts"

export async function main(argv: readonly string[]): Promise<number> {
  const options = parseCommandLine(argv)
  if (options.help) {
    console.log(USAGE)
    return 0
  }
  if (!isBump(options.bump)) {
    console.error(`--bump inválido: "${options.bump}"\n\n${USAGE}`)
    return 2
  }
  return release(process.cwd(), { dryRun: options["dry-run"], yes: options.yes, bump: options.bump })
}

function parseCommandLine(argv: readonly string[]) {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      "dry-run": { type: "boolean", default: false },
      bump: { type: "string", default: "auto" },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
    allowPositionals: false,
  })
  return values
}

async function release(cwd: string, options: ReleaseOptions): Promise<number> {
  const config = readGitFlowConfig(cwd)
  if (!passesPreflight(cwd, config)) return 1
  const plan = await planRelease(cwd, config, options.bump)
  await printPlan(cwd, plan)
  if (options.dryRun) {
    console.log("--dry-run: nada foi alterado.")
    return 0
  }
  if (!options.yes && !(await confirm(`Lançar ${plan.tag}? [s/N] `))) {
    console.log("Cancelado. Nada foi alterado.")
    return 1
  }
  return execute(plan, cwd)
}

function passesPreflight(cwd: string, config: GitFlowConfig): boolean {
  const problems = runPreflight({ cwd, config, remote: REMOTE })
  if (problems.length === 0) return true
  console.error(["✖ O release não pode começar:", ...problems.map((problem) => `  - ${problem}`)].join("\n"))
  return false
}

async function planRelease(cwd: string, config: GitFlowConfig, bump: Bump): Promise<ReleasePlan> {
  return buildPlan({
    config,
    remote: REMOTE,
    currentVersion: readPackageVersion(cwd),
    nextVersion: await bumpedVersion(cwd, bump, config.tagPrefix),
    releaseFiles: RELEASE_FILES.filter((file) => existsSync(join(cwd, file))),
  })
}

async function printPlan(cwd: string, plan: ReleasePlan): Promise<void> {
  console.log(`Release ${plan.currentVersion} → ${plan.version} (${plan.tag})\n`)
  for (const [index, step] of plan.steps.entries()) console.log(`  ${index + 1}. ${step.title}`)
  console.log(`\n${await previewChangelog(cwd, plan.tag)}\n`)
}

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    console.error("Sem terminal interativo para confirmar: rode de novo com --yes.")
    return false
  }
  const readline = createInterface({ input: stdin, output: stdout })
  try {
    return /^s(im)?$/i.test((await readline.question(question)).trim())
  } finally {
    readline.close()
  }
}

async function execute(plan: ReleasePlan, cwd: string): Promise<number> {
  const done: Step[] = []
  for (const step of plan.steps) {
    console.log(`\n→ ${step.title}`)
    try {
      await runStep(step, cwd)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      console.error(`\n${formatFailure(step, done, error)}`)
      return 1
    }
    done.push(step)
  }
  console.log(`\n✔ ${plan.tag} lançado. O workflow "release" do GitHub Actions publica no npm.`)
  return 0
}

async function runStep(step: Step, cwd: string): Promise<void> {
  switch (step.kind) {
    case "run":
      return runVisible(cwd, step.command, step.args)
    case "set-version":
      return setPackageVersion(cwd, step.version)
    case "changelog":
      return writeChangelog(cwd, step.tag)
  }
}
