import { describe, expect, test } from "vitest"

import { executedFiles } from "#src/domain"
import { runsScript } from "#test-helpers"

describe("executedFiles with pwsh and powershell", () => {
  test.each([
    ["pwsh x.ps1", "x.ps1"],
    ["pwsh -NoProfile x.ps1", "x.ps1"],
    ["pwsh -NoProfile -File x.ps1", "x.ps1"],
    ["pwsh -ExecutionPolicy Bypass x.ps1", "x.ps1"],
    ["pwsh -WorkingDirectory app x.ps1", "x.ps1"],
    ["pwsh -ep Bypass -w Hidden x.ps1 arg", "x.ps1"],
    ["pwsh -w hidden x.ps1", "x.ps1"],
    ["pwsh -nop -exec bypass x.ps1", "x.ps1"],
    ["pwsh -exec bypass -fil x.ps1", "x.ps1"],
    ["pwsh -i x.ps1", "x.ps1"],
    ["pwsh -no x.ps1", "x.ps1"],
    ["pwsh -ExecutionPolicy Bypass -File x.ps1", "x.ps1"],
    ["pwsh w.ps1 -f out.txt", "w.ps1"],
    ["pwsh w.ps1 -File out.txt", "w.ps1"],
    ["powershell -nop w.ps1 -f out.txt", "w.ps1"],
    ["pwsh -NoProfile x.ps1 -Command y", "x.ps1"],
    ["powershell -ExecutionPolicy Bypass x.ps1", "x.ps1"],
    ["powershell -exec bypass -File x.ps1", "x.ps1"],
    ["powershell -exec bypass x.ps1", "x.ps1"],
    ["powershell -w hidden x.ps1", "x.ps1"],
    ["powershell -w hidden -nop -exec bypass -f x.ps1", "x.ps1"],
    ["powershell -i Text x.ps1", "x.ps1"],
    ["powershell -Version 5.1 x.ps1", "x.ps1"],
    ["powershell -NoProfile -ExecutionPolicy Bypass -File x.ps1", "x.ps1"],
  ])("%s runs %s", (command, path) => {
    expect(executedFiles(command)).toEqual([runsScript(path)])
  })

  test.each([
    "pwsh",
    "pwsh -NoProfile",
    "pwsh -Command x.ps1",
    "pwsh -c x.ps1",
    "pwsh -CommandWithArgs x.ps1",
    "pwsh -EncodedCommand eAA=",
    "pwsh -ec eAA=",
    "pwsh -e eAA=",
    "pwsh -ep Bypass -c Get-Date",
    "powershell -enc eAA=",
    "powershell -ec eAA=",
    "powershell -exec bypass -enc eAA=",
    "powershell -w hidden -EncodedCommand eAA=",
  ])("%s adds no file: it runs inline code, which the inline_code question reads", (command) => {
    expect(executedFiles(command)).toEqual([])
  })
})
