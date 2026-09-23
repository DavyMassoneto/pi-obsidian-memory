import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanWorkingTree,
  inSyncWithRemote,
  noOpenRelease,
  onDevelopBranch,
  runPreflight,
  versionMatchesLatestTag,
  type PreflightContext,
} from "../../scripts/release/preflight.ts";
import { CONFIG, cleanupTempDirs, commit, git, repoWithRemote, tag, tempDir } from "./helpers.ts";

afterEach(cleanupTempDirs);

const ctx = (cwd: string): PreflightContext => ({ cwd, config: CONFIG, remote: "origin" });

describe("onDevelopBranch", () => {
  it("passa na dev e barra em outra branch", () => {
    const repo = repoWithRemote();
    expect(onDevelopBranch(ctx(repo))).toBeUndefined();

    git(repo, "checkout", "-q", "main");
    expect(onDevelopBranch(ctx(repo))).toMatch(/a partir da dev \(branch atual: main\)/);
  });
});

describe("cleanWorkingTree", () => {
  it("barra arquivos não commitados", () => {
    const repo = repoWithRemote();
    expect(cleanWorkingTree(ctx(repo))).toBeUndefined();

    writeFileSync(join(repo, "rascunho.txt"), "x");
    expect(cleanWorkingTree(ctx(repo))).toMatch(/não commitadas/);
  });
});

describe("noOpenRelease", () => {
  it("barra quando já existe uma release aberta", () => {
    const repo = repoWithRemote();
    expect(noOpenRelease(ctx(repo))).toBeUndefined();

    git(repo, "branch", "release/0.2.0");
    expect(noOpenRelease(ctx(repo))).toMatch(/release\/0\.2\.0/);
  });
});

describe("inSyncWithRemote", () => {
  it("barra a branch com commits que ainda não foram enviados", () => {
    const repo = repoWithRemote();
    expect(inSyncWithRemote("develop")(ctx(repo))).toBeUndefined();

    commit(repo, "feat: ainda não enviado");
    expect(inSyncWithRemote("develop")(ctx(repo))).toMatch(/dev local .* difere de origin\/dev/);
    expect(inSyncWithRemote("main")(ctx(repo))).toBeUndefined();
  });

  it("explica quando o remoto não pode ser consultado", () => {
    const repo = tempDir();
    git(repo, "init", "-q", "-b", "dev");
    commit(repo, "chore: início");

    expect(inSyncWithRemote("develop")(ctx(repo))).toMatch(/não foi possível consultar origin/);
  });
});

describe("versionMatchesLatestTag", () => {
  it("passa sem tags e com a tag da versão atual", () => {
    const repo = repoWithRemote("0.1.0");
    expect(versionMatchesLatestTag(ctx(repo))).toBeUndefined();

    tag(repo, "v0.1.0");
    expect(versionMatchesLatestTag(ctx(repo))).toBeUndefined();
  });

  it("barra quando o package.json não bate com a última tag", () => {
    const repo = repoWithRemote("0.1.0");
    tag(repo, "v0.2.0");

    expect(versionMatchesLatestTag(ctx(repo))).toMatch(/0\.1\.0.*v0\.2\.0/);
  });
});

describe("runPreflight", () => {
  it("reúne todos os problemas encontrados", () => {
    const repo = repoWithRemote();
    git(repo, "checkout", "-q", "main");
    writeFileSync(join(repo, "rascunho.txt"), "x");

    expect(runPreflight(ctx(repo), [onDevelopBranch, cleanWorkingTree, noOpenRelease])).toHaveLength(2);
  });

  it("devolve lista vazia quando está tudo certo", () => {
    const repo = repoWithRemote();

    expect(
      runPreflight(ctx(repo), [onDevelopBranch, cleanWorkingTree, noOpenRelease, inSyncWithRemote("develop"), inSyncWithRemote("main")]),
    ).toEqual([]);
  });
});
