import { mkdir, writeFile } from "node:fs/promises"
import { join, parse } from "node:path"

import { expect, test } from "vitest"

import { canonicalizeAccessPath, fileIdentity, pathIdentities } from "#src/services"
import { useTempFolder, volumeGuidRoot } from "#test-helpers"

test("a volume GUID path keeps the identities of every existing ancestor below the unreadable volume root", async (context) => {
  const root = await useTempFolder()
  const { root: drive } = parse(root)
  const guid = volumeGuidRoot(drive)
  if (!guid) {
    context.skip("the volume GUID of the temp drive cannot be read with mountvol")
    return
  }
  await mkdir(join(root, "vault"))
  await writeFile(join(root, "vault", "note.md"), "preserve")
  const vault = await fileIdentity(join(root, "vault"))
  const temp = await fileIdentity(root)
  const volume = await fileIdentity(drive)
  if (!vault.succeeded || !temp.succeeded || !volume.succeeded) throw new Error("identity setup failed")
  const below = root.slice(drive.length)

  for (const prefix of [guid, guid.replace("\\\\?\\", "\\\\.\\")]) {
    const identities = await pathIdentities(join(prefix, below, "vault", "missing.md"))
    expect(identities.succeeded).toBe(true)
    if (!identities.succeeded) continue
    expect(identities.output[0]).toEqual(vault.output)
    expect(identities.output).toContainEqual(temp.output)
    expect(identities.output).not.toContainEqual(volume.output)
  }
})

test("a volume GUID path is a clean canonicalization failure", async (context) => {
  const root = await useTempFolder()
  const { root: drive } = parse(root)
  const guid = volumeGuidRoot(drive)
  if (!guid) {
    context.skip("the volume GUID of the temp drive cannot be read with mountvol")
    return
  }

  expect(await canonicalizeAccessPath(join(guid, root.slice(drive.length), "note.md"))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^accessPath: .*volume GUID/)],
  })
})
