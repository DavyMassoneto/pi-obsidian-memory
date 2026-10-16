import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, realpath, symlink } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { canonicalizeAccessPath } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("access-path canonicalization resolves junctions and keeps missing tails under real paths", async () => {
  const root = await useTempFolder()
  const vault = join(root, "vault")
  await mkdir(vault)
  await symlink(vault, join(root, "link"), "junction")
  const realVault = await realpath(vault)

  expect(await canonicalizeAccessPath(join(root, "link"))).toEqual({ succeeded: true, output: realVault })
  expect(await canonicalizeAccessPath(join(vault, "notes", "new.md"))).toEqual({
    succeeded: true,
    output: join(realVault, "notes", "new.md"),
  })
  expect(await canonicalizeAccessPath(join(root, "link", "notes", "new.md"))).toEqual({
    succeeded: true,
    output: join(realVault, "notes", "new.md"),
  })
})

test("access-path canonicalization returns a failure for a missing drive and a relative path", async () => {
  const free = "ZYXWVUTSRQPONMLKJIHGFEDCBA".split("").find((letter) => !existsSync(`${letter}:/`))

  expect(await canonicalizeAccessPath(`${free}:\\missing\\file.md`)).toMatchObject({
    succeeded: false,
    problems: [expect.stringContaining("accessPath:")],
  })
  expect(await canonicalizeAccessPath("relative")).toMatchObject({ succeeded: false })
})

test("access-path canonicalization resolves an 8.3 short name to the long name", async (context) => {
  const root = await useTempFolder()
  const longName = "long directory name"
  await mkdir(join(root, longName))
  const listing = spawnSync("cmd.exe", ["/c", "dir", "/x", "/ad", root], { encoding: "utf8" }).stdout
  const short = /\s(\S+~\d\S*)\s+long directory name/i.exec(listing)?.[1]
  if (!short) {
    context.skip("8.3 short names are disabled on the temp volume")
    return
  }

  expect(await canonicalizeAccessPath(join(root, short, "new.md"))).toEqual({
    succeeded: true,
    output: join(await realpath(root), longName, "new.md"),
  })
})
