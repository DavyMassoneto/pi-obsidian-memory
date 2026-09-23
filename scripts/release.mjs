#!/usr/bin/env node
// Release com Git Flow e versão calculada pelos Conventional Commits.
//
//   npm run release -- --dry-run          mostra o plano sem alterar nada
//   npm run release                       executa o release
//   npm run release -- --bump patch       força o incremento (patch | minor | major)
//
// Passos: calcula a próxima versão desde a última tag v*, roda `git flow release start`,
// atualiza package.json e CHANGELOG.md, commita, roda `git flow release finish`
// (merge em main, tag vX.Y.Z, volta para dev) e faz push. A tag dispara a publicação
// no npm pelo GitHub Actions (.github/workflows/release.yml).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bumpAt = args.indexOf("--bump");
const forcedBump = bumpAt >= 0 ? args[bumpAt + 1] : undefined;
if (forcedBump && !["patch", "minor", "major"].includes(forcedBump)) {
  fail(`--bump inválido: "${forcedBump}" (use patch, minor ou major)`);
}

// ---- pré-condições -------------------------------------------------------------------
if (git("branch", "--show-current") !== "dev") fail("rode o release a partir da branch dev");
if (git("status", "--porcelain")) fail("há mudanças não commitadas");
git("fetch", "origin", "--tags", "--quiet");
const behind = git("rev-list", "--count", "dev..origin/dev");
if (behind !== "0") fail(`dev está ${behind} commit(s) atrás de origin/dev: rode git pull antes`);

// ---- versão atual e commits desde a última tag ---------------------------------------
let lastTag = "";
try {
  lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "dev");
} catch {
  // nenhuma tag ainda: começa de 0.0.0
}
const current = lastTag ? lastTag.slice(1) : "0.0.0";
const range = lastTag ? `${lastTag}..dev` : "dev";

const commits = git("log", range, "--no-merges", "--format=%h%x1f%s%x1f%b%x1e")
  .split("\x1e")
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [hash, subject, body = ""] = record.split("\x1f");
    const m = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<desc>.+)$/.exec(subject);
    return {
      hash,
      subject,
      type: m?.groups.type,
      scope: m?.groups.scope,
      desc: m?.groups.desc ?? subject,
      breaking: Boolean(m?.groups.bang) || /^BREAKING[ -]CHANGE:/m.test(body),
    };
  });

// ---- tipo de incremento (em 0.x, breaking change sobe o minor) -----------------------
const major = Number(current.split(".")[0]);
let bump = forcedBump;
if (!bump) {
  if (commits.some((c) => c.breaking)) bump = major === 0 ? "minor" : "major";
  else if (commits.some((c) => c.type === "feat")) bump = "minor";
  else if (commits.some((c) => c.type === "fix" || c.type === "perf")) bump = "patch";
}
if (!bump) {
  fail(`nenhum commit feat/fix/perf/breaking desde ${lastTag || "o início"}. Para lançar mesmo assim: npm run release -- --bump patch`);
}
const next = increment(current, bump);

// ---- seção do changelog --------------------------------------------------------------
const functional = ["feat", "fix", "perf"];
const groups = [
  ["⚠️ Mudanças incompatíveis", (c) => c.breaking],
  ["Novidades", (c) => c.type === "feat" && !c.breaking],
  ["Correções", (c) => c.type === "fix" && !c.breaking],
  ["Desempenho", (c) => c.type === "perf" && !c.breaking],
  ["Manutenção", (c) => c.type && !functional.includes(c.type) && !c.breaking && !(c.type === "chore" && c.scope === "release")],
];
let section = `## [${next}] - ${new Date().toISOString().slice(0, 10)}\n`;
for (const [title, match] of groups) {
  const items = commits.filter(match);
  if (items.length === 0) continue;
  section += `\n### ${title}\n\n`;
  section += items.map((c) => `- ${c.scope ? `**${c.scope}:** ` : ""}${c.desc} (${c.hash})`).join("\n") + "\n";
}
const nonConventional = commits.filter((c) => !c.type);

console.log(`Versão atual: ${current}${lastTag ? ` (${lastTag})` : " (sem tag)"}`);
console.log(`Commits considerados: ${commits.length} · incremento: ${bump}${forcedBump ? " (forçado)" : ""}`);
console.log(`Próxima versão: ${next}\n`);
console.log(section);
if (nonConventional.length > 0) {
  console.log(`Aviso: ${nonConventional.length} commit(s) fora do padrão Conventional Commits (não contam para a versão):`);
  for (const c of nonConventional) console.log(`  ${c.hash} ${c.subject}`);
}
if (dryRun) {
  console.log("\n--dry-run: nada foi alterado.");
  process.exit(0);
}

// ---- Git Flow ------------------------------------------------------------------------
run("git", ["flow", "release", "start", next]);

const pkgPath = "package.json";
writeFileSync(pkgPath, readFileSync(pkgPath, "utf8").replace(/"version":\s*"[^"]*"/, `"version": "${next}"`));

const marker = "<!-- releases -->";
const changelog = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : `# Changelog\n\n${marker}\n`;
writeFileSync(
  "CHANGELOG.md",
  changelog.includes(marker) ? changelog.replace(marker, `${marker}\n\n${section.trimEnd()}`) : `${changelog.trimEnd()}\n\n${section}`,
);

run("git", ["add", "package.json", "CHANGELOG.md"]);
run("git", ["commit", "-m", `chore(release): v${next}`]);
run("git", ["flow", "release", "finish", next, "-m", `v${next}`]);
run("git", ["push", "origin", "main", "dev", "--follow-tags"]);

console.log(`\nRelease v${next} publicado no GitHub. O workflow "release" vai publicar no npm.`);

// ---- utilitários ---------------------------------------------------------------------
function git(...gitArgs) {
  // stderr capturado: erros esperados (ex.: describe sem tags) não poluem a saída
  return execFileSync("git", gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { stdio: "inherit", env: { ...process.env, GIT_MERGE_AUTOEDIT: "no" } });
}

function increment(version, kind) {
  const [maj, min, pat] = version.split(".").map(Number);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
