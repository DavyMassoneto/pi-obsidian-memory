import { createServer } from "node:http"

import { onTestFinished } from "vitest"

import { layaReply } from "./decision-model.ts"
import type { LayaAsk, LayaRequestBody, LayaScript } from "./types.ts"

function askedOf(text: string): LayaAsk {
  const body: LayaRequestBody = JSON.parse(text)
  let question: LayaAsk["question"] = "relevant"
  if ("needed" in body.questions) question = "needed"
  let statement: string | null = null
  if (body.state.candidate) statement = body.state.candidate.statement
  return { question, message: body.state.message, statement }
}

export function relevanceScript(needed: number, byStatement: Map<string, number>): LayaScript {
  return (ask) => {
    if (ask.question === "needed") return needed
    if (typeof ask.statement !== "string") return 0
    const probability = byStatement.get(ask.statement)
    if (typeof probability !== "number") return 0
    return probability
  }
}

export async function scriptedLaya(script: LayaScript) {
  const asked: LayaAsk[] = []
  const server = createServer((request, response) => {
    let text = ""
    request.setEncoding("utf8")
    request.on("data", (chunk: string) => {
      text += chunk
    })
    request.on("end", () => {
      const ask = askedOf(text)
      asked.push(ask)
      response.end(layaReply(script(ask)).replaceAll("needed", ask.question))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  onTestFinished(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  )
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No synthetic server address")
  return { asked, endpoint: `http://127.0.0.1:${address.port}/v1/systemone` }
}

export function layaReplyWithoutRouting(probability: number): string {
  const reply = JSON.parse(layaReply(probability))
  return JSON.stringify(Object.fromEntries(Object.entries(reply).filter(([key]) => key !== "routing")))
}
