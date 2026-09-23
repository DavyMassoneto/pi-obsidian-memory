import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseGitFlowConfig, readGitFlowConfig } from "../../scripts/release/gitflow.ts";
import { CONFIG, cleanupTempDirs, tempDir } from "./helpers.ts";

afterEach(cleanupTempDirs);

describe("readGitFlowConfig", () => {
  it("lê o .gitflow deste projeto", () => {
    const dir = tempDir();
    copyFileSync(join(import.meta.dirname, "..", "..", ".gitflow"), join(dir, ".gitflow"));

    expect(readGitFlowConfig(dir)).toEqual(CONFIG);
  });

  it("explica o que fazer quando não há .gitflow", () => {
    expect(() => readGitFlowConfig(tempDir())).toThrow(/git flow init --shared/);
  });
});

describe("parseGitFlowConfig", () => {
  const listing = (lines: string[]) => lines.join("\n");

  it("identifica produção e integração pela hierarquia, não pelo nome", () => {
    const config = parseGitFlowConfig(
      listing([
        "gitflow.branch.trunk.type=base",
        "gitflow.branch.integration.type=base",
        "gitflow.branch.integration.parent=trunk",
        "gitflow.branch.release.type=topic",
        "gitflow.branch.release.prefix=rel/",
      ]),
    );

    expect(config).toEqual({ main: "trunk", develop: "integration", releasePrefix: "rel/", tagPrefix: "" });
  });

  it("aceita finais de linha CRLF", () => {
    const config = parseGitFlowConfig(
      "gitflow.branch.main.type=base\r\ngitflow.branch.dev.type=base\r\ngitflow.branch.dev.parent=main\r\ngitflow.branch.release.prefix=release/\r\ngitflow.branch.release.tagprefix=v\r\n",
    );

    expect(config).toEqual(CONFIG);
  });

  it("recusa configuração sem branch de integração", () => {
    expect(() =>
      parseGitFlowConfig(listing(["gitflow.branch.main.type=base", "gitflow.branch.release.prefix=release/"])),
    ).toThrow(/integração/);
  });

  it("recusa configuração sem prefixo de release", () => {
    expect(() =>
      parseGitFlowConfig(
        listing(["gitflow.branch.main.type=base", "gitflow.branch.dev.type=base", "gitflow.branch.dev.parent=main"]),
      ),
    ).toThrow(/prefixo das branches de release/);
  });
});
