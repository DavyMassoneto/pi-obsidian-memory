import type { ClassifierPrompt } from "#src/pi/context"
import type { JevPrompt, JevQuestion } from "./types.ts"

function questionOf(question: JevQuestion) {
  return {
    type: question.type,
    instructions: question.instructions,
    criteria: { true: question.criteria.true, false: question.criteria.false },
  }
}

function stateOf(state: JevPrompt["state"]) {
  if ("candidate" in state) {
    return { message: state.message, candidate: { statement: state.candidate.statement, body: state.candidate.body } }
  }
  return { message: state.message, project: state.project, folder: state.folder }
}

export function classifierPrompt(prompt: JevPrompt): ClassifierPrompt {
  const { state, questions } = prompt
  if ("needed" in questions) return { state: stateOf(state), questions: { needed: questionOf(questions.needed) } }
  return { state: stateOf(state), questions: { relevant: questionOf(questions.relevant) } }
}
