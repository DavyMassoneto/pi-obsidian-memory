import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { enumerateVault, inspectVaultFile } from "#/services"
import { synchronizeMemory } from "#/usecases"
import {
  denySynchronizationRead,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  validFrontmatterLines,
} from "#test-helpers"

test.skipIf(process.platform !== "win32")(
  "unchanged unreadable notes are reused; changed unreadable notes retain cached rows",
  async (testContext) => {
    const { vault, context } = await memoryReadFixture()
    await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory original"))
    await synchronizeMemory({ vault: "global" }, context)
    const path = await synchronizedIndexPath(context, vault.path)
    const before = synchronizedCatalog(path).inventory
    const restore = await denySynchronizationRead(join(vault.path, "Note.md"))
    try {
      expect(await enumerateVault(vault)).toMatchObject({ succeeded: true, output: { failures: [] } })
      const denied = await inspectVaultFile(vault, { path: "Note.md" })
      if (denied.succeeded) testContext.skip("This Node runtime reads despite the temporary ReadData-deny ACL")
      expect(denied.succeeded).toBe(false)
      expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
        succeeded: true,
        output: { committed: false, coverage: "complete", warnings: [] },
      })
      expect(synchronizedCatalog(path).inventory).toEqual(before)
    } finally {
      await restore()
    }
    await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory changed longer body"))
    const readable = await denySynchronizationRead(join(vault.path, "Note.md"))
    try {
      const degraded = await synchronizeMemory({ vault: "global" }, context)
      expect(degraded).toMatchObject({ succeeded: true, output: { coverage: "degraded", population: "ready" } })
      if (!degraded.succeeded) throw new Error("sync required")
      expect(degraded.output.warnings.length).toBeGreaterThan(0)
      expect(synchronizedCatalog(path).inventory).toEqual(before)
      await rm(path)
      expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
        succeeded: true,
        output: { coverage: "degraded", population: "needs-population" },
      })
      expect(synchronizedCatalog(path).inventory).toMatchObject({ entries: [], population: "needs-population" })
    } finally {
      await readable()
    }
    expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
      succeeded: true,
      output: { coverage: "complete", population: "ready" },
    })
    expect(synchronizedCatalog(path).inventory.entries[0]?.note?.body).toBe("memory changed longer body")
  },
)
