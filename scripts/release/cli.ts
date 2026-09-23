// Release com Git Flow e versão calculada pelos Conventional Commits (via git-cliff).
// Uso: npm run release -- [--dry-run] [--bump patch|minor|major] [--yes]
// Decisão e regras: docs/decisions/0001-versionamento-automatico-e-publicacao-npm.md
import { existsSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { nextVersion, previewChangelog, writeChangelog } from "./cliff.ts";
import { runVisible } from "./git.ts";
import { readGitFlowConfig } from "./gitflow.ts";
import { buildPlan, NothingToRelease, type ReleasePlan, type Step } from "./plan.ts";
import { runPreflight } from "./preflight.ts";
import { formatFailure } from "./recovery.ts";
import { isBump, readPackageVersion, setPackageVersion } from "./version.ts";

const REMOTE = "origin";

const USAGE = `Uso: npm run release -- [opções]

  --dry-run          mostra o plano e o changelog sem alterar nada
  --bump <tipo>      força o incremento: patch | minor | major (padrão: automático)
  -y, --yes          não pede confirmação (só com autorização explícita)
  -h, --help         mostra esta ajuda`;

async function main(argv: readonly string[]): Promise<number> {
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
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (!isBump(values.bump)) {
    console.error(`--bump inválido: "${values.bump}"\n\n${USAGE}`);
    return 2;
  }

  const cwd = process.cwd();
  const config = readGitFlowConfig(cwd);
  const problems = runPreflight({ cwd, config, remote: REMOTE });
  if (problems.length > 0) {
    console.error(["✖ O release não pode começar:", ...problems.map((problem) => `  - ${problem}`)].join("\n"));
    return 1;
  }

  const current = readPackageVersion(cwd);
  let plan: ReleasePlan;
  try {
    plan = buildPlan({
      config,
      remote: REMOTE,
      current,
      next: await nextVersion(cwd, values.bump, config.tagPrefix),
      files: releaseFiles(cwd),
    });
  } catch (error) {
    if (!(error instanceof NothingToRelease)) throw error;
    console.error(`✖ ${error.message}`);
    return 1;
  }

  printPlan(plan, current);
  console.log(`${await previewChangelog(cwd, plan.tag)}\n`);
  if (values["dry-run"]) {
    console.log("--dry-run: nada foi alterado.");
    return 0;
  }
  if (!values.yes && !(await confirm(`Lançar ${plan.tag}? [s/N] `))) {
    console.log("Cancelado. Nada foi alterado.");
    return 1;
  }
  return execute(plan, cwd);
}

function releaseFiles(cwd: string): string[] {
  return ["package.json", "package-lock.json", "CHANGELOG.md"].filter((file) => existsSync(join(cwd, file)));
}

function printPlan(plan: ReleasePlan, current: string): void {
  console.log(`Release ${current} → ${plan.version} (${plan.tag})\n`);
  plan.steps.forEach((step, index) => console.log(`  ${index + 1}. ${step.title}`));
  console.log("");
}

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    console.error("Sem terminal interativo para confirmar: rode de novo com --yes.");
    return false;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return /^s(im)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

async function execute(plan: ReleasePlan, cwd: string): Promise<number> {
  const done: Step[] = [];
  for (const step of plan.steps) {
    console.log(`\n→ ${step.title}`);
    try {
      await runStep(step, cwd);
    } catch (error) {
      console.error(`\n${formatFailure(step, done, error)}`);
      return 1;
    }
    done.push(step);
  }
  console.log(`\n✔ ${plan.tag} lançado. O workflow "release" do GitHub Actions publica no npm.`);
  return 0;
}

async function runStep(step: Step, cwd: string): Promise<void> {
  switch (step.kind) {
    case "run":
      return runVisible(cwd, step.command, step.args);
    case "set-version":
      return setPackageVersion(cwd, step.version);
    case "changelog":
      return writeChangelog(cwd, step.tag);
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  },
);
