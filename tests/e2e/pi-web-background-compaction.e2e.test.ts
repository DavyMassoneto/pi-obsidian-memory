import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import Type, { type Static } from "typebox"
import { Check } from "typebox/value"
import { expect, test } from "vitest"

import { COMPACTION_DETAILS_TYPE, RESUME_TYPE } from "#src/usecases"
import {
  readWebTimeline,
  safeWebError,
  webEvents,
  webModel,
  webProvider,
  webRequest,
  webSessionFile,
  withPiWeb,
} from "#test-helpers"

const session = Type.Object({ sessionId: Type.String() })
const details = Type.Object({
  kind: Type.Literal("pi-web-subagent"),
  sessionId: Type.String(),
  runInBackground: Type.Boolean(),
  status: Type.String(),
})
const textBlock = Type.Object({ type: Type.Literal("text"), text: Type.String() })
const message = Type.Object({ role: Type.String() })
const assistantError = Type.Object({
  role: Type.Literal("assistant"),
  stopReason: Type.Literal("error"),
  errorMessage: Type.Optional(Type.String()),
})
const agentResult = Type.Object({ role: Type.Literal("toolResult"), toolName: Type.Literal("Agent") })
const agentDispatch = Type.Intersect([agentResult, Type.Object({ details })])
const parentNotification = Type.Object({
  role: Type.Literal("custom"),
  customType: Type.Literal("pi-web:subagent-notification"),
  details,
  content: Type.String(),
})
const readResult = Type.Object({
  role: Type.Literal("toolResult"),
  toolName: Type.Literal("read"),
  content: Type.Array(textBlock),
})
const event = Type.Union([
  Type.Object({ type: Type.Literal("connected") }),
  Type.Object({ type: Type.Literal("agent_settled") }),
  Type.Object({ type: Type.Literal("message_end"), message }),
])
const entry = Type.Object({
  type: Type.String(),
  customType: Type.Optional(Type.String()),
  message: Type.Optional(message),
})
const memoryCompaction = Type.Object({
  type: Type.Literal("compaction"),
  fromHook: Type.Literal(true),
  details: Type.Object({ type: Type.Literal(COMPACTION_DETAILS_TYPE) }),
})
const runResponse = Type.Object({
  run: Type.Object({
    sessionId: Type.String(),
    parentSessionId: Type.String(),
    sessionPath: Type.String(),
    runInBackground: Type.Boolean(),
    status: Type.String(),
    result: Type.Optional(Type.String()),
  }),
})

function readText(value: Static<typeof message> | undefined): string {
  if (!Check(readResult, value)) return ""
  return value.content.map((item) => item.text).join("\n")
}

async function delegate(base: string, parentId: string) {
  await webRequest(Type.Object({ success: Type.Literal(true) }), base, `/api/agent/${parentId}`, "POST", {
    type: "prompt",
    message:
      'Call Agent exactly once with subagent_type "e2e-compact", description "Read chain", and run_in_background true. Delegate exactly this task in its prompt: "Use read to open start.txt. Follow the instruction on its first line. Read each named file individually, one tool call per turn. Return only the receipt from the last file." After dispatch, end your turn without waiting or retrieving results.',
  })
}

function assertParentModel(msg: Static<typeof message>) {
  if (!Check(assistantError, msg)) return
  let reason = "No error message"
  if (msg.errorMessage) reason = safeWebError(msg.errorMessage)
  throw new Error(`Real parent model failed: ${reason}`)
}

function launchedChild(msg: Static<typeof message>): string | undefined {
  if (!Check(agentResult, msg)) return undefined
  if (!Check(agentDispatch, msg)) throw new Error("Pi Web Agent tool did not dispatch a child")
  expect(msg.details.runInBackground).toBe(true)
  return msg.details.sessionId
}

async function parentReport(base: string, id: string) {
  const control = new AbortController()
  let childId: string | undefined
  try {
    for await (const data of webEvents(event, base, id, control.signal)) {
      if (data.type === "connected") await delegate(base, id)
      if (data.type === "agent_settled" && !childId)
        throw new Error("Parent settled without dispatching a background child")
      if (data.type !== "message_end") continue
      const msg = data.message
      assertParentModel(msg)
      const launched = launchedChild(msg)
      if (launched) childId = launched
      if (Check(parentNotification, msg)) {
        expect(msg.details.sessionId).toBe(childId)
        expect(msg.details.status).toBe("completed")
        return { id: msg.details.sessionId, text: msg.content }
      }
    }
    throw new Error("Pi Web SSE closed before automatic background report")
  } finally {
    control.abort()
  }
}

test("Pi Web delivers the background child's result after memory compaction between tool turns", async () => {
  const receipt = `receipt-${randomUUID()}`
  await withPiWeb(async (base, cwd, isolatedRoot) => {
    const payload = "The crates stay on numbered shelves until the warehouse closes for inventory.\n".repeat(78)
    const second = `next-${randomUUID()}.txt`
    const last = `last-${randomUUID()}.txt`
    await Promise.all([
      writeFile(
        join(cwd, "start.txt"),
        `Next, read ${second}.
${payload}`,
      ),
      writeFile(
        join(cwd, second),
        `Next, read ${last}.
${payload}`,
      ),
      writeFile(
        join(cwd, last),
        `Return exactly this receipt: ${receipt}
`,
      ),
    ])
    const parent = await webRequest(session, base, "/api/agent/new", "POST", {
      type: "ensure_session",
      cwd,
      provider: webProvider,
      modelId: webModel,
      thinkingLevel: "low",
      toolNames: ["read"],
    })
    const report = await parentReport(base, parent.sessionId)
    const { run } = await webRequest(runResponse, base, `/api/subagents/${report.id}`, "GET")
    expect(run.parentSessionId).toBe(parent.sessionId)
    expect(run.runInBackground).toBe(true)
    const file = await webSessionFile(isolatedRoot, run.sessionId)
    expect(run.sessionPath).toBe(file)
    const timeline = await readWebTimeline(entry, file)
    const compacted = timeline.findIndex((item) => Check(memoryCompaction, item))
    const firstRead = timeline.findIndex((item) => readText(item.message).includes(second))
    const resultEntry = timeline.findIndex((item) => item.customType === "pi-web:subagent-result")
    const receiptRead = timeline.findIndex((item) => readText(item.message).includes(receipt))
    expect(firstRead, "first read must be recorded in the child").toBeGreaterThanOrEqual(0)
    expect(
      compacted,
      `expected memory compaction mid-task (first read=${firstRead}, receipt read=${receiptRead}, persisted result=${resultEntry}, child status=${run.status})`,
    ).toBeGreaterThan(firstRead)
    expect(receiptRead, "child must do more real work after compaction").toBeGreaterThan(compacted)
    expect(resultEntry, "Pi Web must not record completion before that work").toBeGreaterThan(receiptRead)
    expect(timeline.filter((item) => item.message?.role === "user")).toHaveLength(1)
    expect(timeline.some((item) => item.customType === RESUME_TYPE)).toBe(false)
    expect(run.status).toBe("completed")
    expect(run.result).toBe(receipt)
    expect(report.text).toContain(receipt)
  })
})
