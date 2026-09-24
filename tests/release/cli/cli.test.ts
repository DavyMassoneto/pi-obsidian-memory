import { describe, expect, it } from "vitest"

import { readOptions } from "#scripts"

describe("readOptions", () => {
  it("sem argumentos, as flags ficam desligadas e a versão sai dos commits", () => {
    expect(readOptions([])).toEqual({ "dry-run": false, bump: "auto", yes: false, help: false })
  })

  it("lê as opções informadas", () => {
    expect(readOptions(["--dry-run", "--bump", "minor", "-y"])).toEqual({
      "dry-run": true,
      bump: "minor",
      yes: true,
      help: false,
    })
  })

  it("recusa --bump desconhecido", () => {
    expect(() => readOptions(["--bump", "nada"])).toThrow(
      /opções da linha de comando .*fora do formato esperado: \/bump/,
    )
  })

  it("recusa opção desconhecida", () => {
    expect(() => readOptions(["--xyz"])).toThrow(/xyz/)
  })
})
