import { afterEach, expect, test, vi } from "vitest"

import { diagnoseMemory } from "#src/usecases"
import {
  LOCAL_MODEL_ID,
  LOCAL_PROVIDER,
  realDiagnoseProbes,
  searchFixture,
  useTempFolder,
  writeRegistrationSnapshot,
} from "#test-helpers"

afterEach(() => {
  vi.unstubAllEnvs()
})

test("the diagnosis carries whether OM is loaded", async () => {
  const { context } = await searchFixture()
  const probes = await realDiagnoseProbes(await useTempFolder())

  const loaded = await diagnoseMemory({ ...probes, omLoaded: true }, context)
  const absent = await diagnoseMemory({ ...probes, omLoaded: false }, context)

  expect(loaded).toMatchObject({ succeeded: true, output: { omLoaded: true } })
  expect(absent).toMatchObject({ succeeded: true, output: { omLoaded: false } })
})

test("the doctor checks the observer and memory agent models", async () => {
  const { context, config } = await searchFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({
      ...config,
      observer: { ...config.observer, model: { provider: LOCAL_PROVIDER, id: LOCAL_MODEL_ID } },
      memoryAgent: { model: { provider: "anthropic", id: "claude-sonnet-4-5" } },
    }),
  )
  const probes = await realDiagnoseProbes(await useTempFolder())

  const result = await diagnoseMemory({ ...probes, omLoaded: false }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      models: [
        { role: "observer", check: { model: { provider: LOCAL_PROVIDER, id: LOCAL_MODEL_ID }, status: "ok" } },
        {
          role: "memory agent",
          check: { model: { provider: "anthropic", id: "claude-sonnet-4-5" }, status: "no-credentials" },
        },
      ],
    },
  })
})
