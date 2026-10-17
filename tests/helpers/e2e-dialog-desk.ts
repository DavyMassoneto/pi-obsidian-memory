import {
  cancelReply,
  type DialogReply,
  replyFor,
  replyTo,
  type UiAnswer,
  type UiStep,
  type UnexpectedDialog,
} from "./e2e-protocol.ts"
import type { DialogRequest } from "./e2e-records.ts"

type SendReply = (reply: DialogReply) => void

export class DialogDesk {
  readonly unexpected: UnexpectedDialog[] = []
  #steps: UiStep[] = []
  #open: DialogRequest[] = []
  #sendReply: SendReply

  constructor(sendReply: SendReply) {
    this.#sendReply = sendReply
  }

  plan(steps: UiStep[]): void {
    this.#steps.push(...steps)
  }

  answer(request: DialogRequest): void {
    const reply = replyFor(request, this.#steps.shift())
    if (reply === "open") {
      this.#open.push(request)
      return
    }
    if (reply) {
      this.#sendReply(reply)
      return
    }
    this.unexpected.push({ method: request.method, title: request.title })
    this.#sendReply(cancelReply(request))
  }

  answerOpen(answer: UiAnswer): void {
    const request = this.#open.shift()
    if (!request) throw new Error("no dialog is left open")
    const reply = replyTo(request, answer)
    if (!reply) throw new Error(`cannot answer the open ${request.method} "${request.title}" with that answer`)
    this.#sendReply(reply)
  }

  refuseUnusedSteps(): void {
    const unused = this.#steps.splice(0)
    if (unused.length > 0)
      throw new Error(`unused steps: ${unused.map((step) => `${step.method} "${step.title}"`).join(", ")}`)
  }
}
