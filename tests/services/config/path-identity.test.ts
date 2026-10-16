import { existsSync } from "node:fs"
import { mkdir, symlink, writeFile } from "node:fs/promises"
import { join, parse } from "node:path"

import { expect, test } from "vitest"

import { fileIdentity, pathIdentities } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("file identity is an exact string pair that is stable across calls and differs between folders", async () => {
  const root = await useTempFolder()
  await mkdir(join(root, "one"))
  await mkdir(join(root, "two"))
  const one = await fileIdentity(join(root, "one"))

  expect(one).toEqual({
    succeeded: true,
    output: { device: expect.stringMatching(/^\d+$/), inode: expect.stringMatching(/^\d+$/) },
  })
  expect(await fileIdentity(join(root, "one"))).toEqual(one)
  expect(await fileIdentity(join(root, "two"))).not.toEqual(one)
})

test("a junction into a vault yields the vault identity among the ancestors of a missing file below it", async () => {
  const root = await useTempFolder()
  const vault = join(root, "vault")
  await mkdir(join(vault, "notes"), { recursive: true })
  await symlink(vault, join(root, "link"), "junction")
  const vaultIdentity = await fileIdentity(vault)
  const notes = await fileIdentity(join(vault, "notes"))
  if (!vaultIdentity.succeeded || !notes.succeeded) throw new Error("identity setup failed")

  const viaJunction = await pathIdentities(join(root, "link", "notes", "missing", "new.md"))

  expect(viaJunction.succeeded).toBe(true)
  if (!viaJunction.succeeded) return
  expect(viaJunction.output[0]).toEqual(notes.output)
  expect(viaJunction.output).toContainEqual(vaultIdentity.output)
  expect(await pathIdentities(join(vault, "notes", "missing", "new.md"))).toEqual(viaJunction)
})

test("an existing file is its own deepest identity and the list ends at the volume root", async () => {
  const root = await useTempFolder()
  await writeFile(join(root, "note.md"), "preserve")
  const file = await fileIdentity(join(root, "note.md"))
  const volume = await fileIdentity(parse(root).root)

  const identities = await pathIdentities(join(root, "note.md"))

  if (!file.succeeded || !volume.succeeded || !identities.succeeded) throw new Error("identity setup failed")
  expect(identities.output[0]).toEqual(file.output)
  expect(identities.output.at(-1)).toEqual(volume.output)
})

test("a file below a regular file and a missing drive give failures instead of throwing", async () => {
  const root = await useTempFolder()
  await writeFile(join(root, "note.md"), "preserve")
  const free = "ZYXWVUTSRQPONMLKJIHGFEDCBA".split("").find((letter) => !existsSync(`${letter}:/`))

  expect((await pathIdentities(join(root, "note.md", "below"))).succeeded).toBe(true)
  expect(await pathIdentities(`${free}:/missing/file.md`)).toMatchObject({
    succeeded: false,
    problems: [expect.any(String)],
  })
  expect(await fileIdentity(`${free}:/missing`)).toMatchObject({ succeeded: false })
  expect(await pathIdentities("relative")).toMatchObject({ succeeded: false })
  expect(await fileIdentity(join(root, "missing"))).toMatchObject({ succeeded: false })
})

test("an administrative-share alias of a temp folder has the same identity as its drive path", async (context) => {
  const root = await useTempFolder()
  const { root: volume } = parse(root)
  const share = `//localhost/${volume[0]}$/`
  if (!existsSync(share)) {
    context.skip("the administrative share //localhost/<drive>$ is not available on this machine")
    return
  }
  const alias = `${share}${root.slice(volume.length)}`

  const direct = await pathIdentities(join(root, "missing.md"))
  const aliased = await pathIdentities(join(alias, "missing.md"))

  expect(aliased).toEqual(direct)
})
