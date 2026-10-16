import { createServer } from "node:http"

import { onTestFinished } from "vitest"

import { layaBatchReply, layaReply } from "./decision-model.ts"
import type { LayaAsk, LayaRequestBody, LayaScript } from "./types.ts"

function askedOf(body: LayaRequestBody, state: LayaRequestBody["state"]): LayaAsk {
  let question: LayaAsk["question"] = "relevant"
  if ("needed" in body.questions) question = "needed"
  let statement: string | null = null
  if (state.candidate) statement = state.candidate.statement
  return { question, message: state.message, statement }
}

function replyOf(ask: LayaAsk, probability: number | null): string {
  if (typeof probability !== "number") return JSON.stringify({ ...JSON.parse(layaReply(0)), answers: {} })
  return layaReply(probability).replaceAll("needed", ask.question)
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

export function failingFor(script: LayaScript, statements: string[]): LayaScript {
  return (ask) => {
    if (typeof ask.statement === "string" && statements.includes(ask.statement)) return null
    return script(ask)
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
      const body: LayaRequestBody = JSON.parse(text)
      if (request.url?.endsWith("/batch")) {
        let states: LayaRequestBody["state"][] = []
        if (body.states) states = body.states
        const replies = states.map((state) => {
          const ask = askedOf(body, state)
          asked.push(ask)
          return replyOf(ask, script(ask))
        })
        response.end(layaBatchReply(replies))
        return
      }
      const ask = askedOf(body, body.state)
      asked.push(ask)
      const probability = script(ask)
      if (typeof probability !== "number") {
        response.statusCode = 500
        response.end("")
        return
      }
      response.end(replyOf(ask, probability))
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
