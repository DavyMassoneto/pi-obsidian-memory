import { afterEach, describe, expect, it } from "vitest"

import { git, runVisible, tryGit } from "#scripts"
import { cleanupTempDirs, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

describe("git", () => {
  it("devolve a saída sem espaços nas pontas", () => {
    const dir = tempDir()
    git(dir, ["init", "-q", "-b", "dev"])

    expect(git(dir, ["branch", "--show-current"])).toBe("dev")
  })

  it("inclui o comando e a saída de erro na falha", () => {
    expect(() => git(tempDir(), ["rev-parse", "HEAD"])).toThrow(/git rev-parse HEAD falhou: \S/)
  })
})

describe("tryGit", () => {
  it("devolve a saída quando o comando dá certo", () => {
    const dir = tempDir()
    git(dir, ["init", "-q", "-b", "dev"])

    expect(tryGit(dir, ["branch", "--show-current"])).toEqual({ succeeded: true, output: "dev" })
  })

  it("avisa quando o comando falha", () => {
    expect(tryGit(tempDir(), ["rev-parse", "HEAD"])).toEqual({ succeeded: false })
  })
})

describe("runVisible", () => {
  it("informa o código de saída", () => {
    expect(() => runVisible(tempDir(), process.execPath, ["-e", "process.exit(3)"])).toThrow(/saiu com código 3/)
  })

  it("informa quando o comando não existe", () => {
    expect(() => runVisible(tempDir(), "comando-que-nao-existe", [])).toThrow(/comando-que-nao-existe falhou: .*ENOENT/)
  })
})
