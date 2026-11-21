import type { ClassifierPrompt } from "#src/pi/context"
import type { ShellEditPrompt, ShellEditQuestion } from "#src/usecases"

function questionOf(question: ShellEditQuestion) {
  return {
    type: question.type,
    instructions: question.instructions,
    criteria: { true: question.criteria.true, false: question.criteria.false },
  }
}

export function shellEditClassifierPrompt(prompt: ShellEditPrompt): ClassifierPrompt {
  const { state, questions } = prompt
  return {
    state: {
      command: state.command,
      cwd: state.cwd,
      scripts: state.scripts.map((script) => ({ path: script.path, text: script.text })),
      missing: [...state.missing],
    },
    questions: {
      redirection: questionOf(questions.redirection),
      in_place: questionOf(questions.in_place),
      inline_code: questionOf(questions.inline_code),
      script_writes: questionOf(questions.script_writes),
      copy_download: questionOf(questions.copy_download),
      hardlink: questionOf(questions.hardlink),
    },
  }
}
