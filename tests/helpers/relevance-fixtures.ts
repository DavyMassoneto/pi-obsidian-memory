import type { CandidateContent } from "#src/services"
import { type NoteKey, notes } from "./relevance-notes.ts"
import { type HoldoutMarked, withHoldout } from "./threshold-report.ts"

export interface RelevanceCase {
  message: string
  candidate: CandidateContent
  positive: boolean
}

export type RelevanceExample = RelevanceCase & HoldoutMarked

const pairs: [boolean, string, NoteKey][] = [
  [true, "Qual gerenciador de pacotes uso neste projeto?", "note1"],
  [true, "Set up the test runner the way I like it.", "note2"],
  [true, "Escreve o commit message no formato que eu costumo usar.", "note3"],
  [true, "Which database did we pick for orders?", "note4"],
  [true, "Como eu configurei o deploy da última vez?", "note5"],
  [true, "What is my preferred code style for React components?", "note6"],
  [true, "Responde em português, como sempre peço.", "note7"],
  [true, "Apply the same retry policy we used in the payments service.", "note8"],
  [true, "Qual era mesmo o prazo que o cliente deu para a fase dois?", "note9"],
  [true, "What are my dietary restrictions again?", "note10"],
  [true, "Planeja a viagem considerando minhas preferências de hotel.", "note11"],
  [true, "Sugere um treino respeitando minha lesão no joelho.", "note12"],
  [true, "Which editor and keybindings do I use?", "note13"],
  [true, "Qual fuso horário eu uso para marcar reuniões?", "note14"],
  [true, "Use the same naming convention we agreed on for the API routes.", "note15"],
  [false, "Qual gerenciador de pacotes uso neste projeto?", "note16"],
  [false, "Set up the test runner the way I like it.", "note17"],
  [false, "Escreve o commit message no formato que eu costumo usar.", "note11"],
  [false, "Which database did we pick for orders?", "note7"],
  [false, "Como eu configurei o deploy da última vez?", "note10"],
  [false, "What is my preferred code style for React components?", "note14"],
  [false, "Responde em português, como sempre peço.", "note4"],
  [false, "Apply the same retry policy we used in the payments service.", "note12"],
  [false, "Qual era mesmo o prazo que o cliente deu para a fase dois?", "note13"],
  [false, "What are my dietary restrictions again?", "note5"],
  [false, "Planeja a viagem considerando minhas preferências de hotel.", "note3"],
  [false, "Sugere um treino respeitando minha lesão no joelho.", "note6"],
  [false, "Which editor and keybindings do I use?", "note9"],
  [false, "Qual fuso horário eu uso para marcar reuniões?", "note8"],
  [false, "Use the same naming convention we agreed on for the API routes.", "note1"],
  [true, "Lembra qual foi o orçamento que defini para o notebook novo?", "note18"],
  [true, "Continue de onde paramos ontem na migração do banco.", "note19"],
  [true, "Which linter rules did we turn off, and for what reason?", "note20"],
  [true, "Draft the email in the tone I normally use with my manager.", "note21"],
  [true, "Reserva a sala com o setup que eu prefiro.", "note22"],
  [false, "Lembra qual foi o orçamento que defini para o notebook novo?", "note20"],
  [false, "Continue de onde paramos ontem na migração do banco.", "note21"],
  [false, "Which linter rules did we turn off, and for what reason?", "note18"],
  [false, "Draft the email in the tone I normally use with my manager.", "note19"],
  [false, "Reserva a sala com o setup que eu prefiro.", "note12"],
  [false, "Qual gerenciador de pacotes uso neste projeto?", "note23"],
  [false, "Set up the test runner the way I like it.", "note24"],
  [false, "Which database did we pick for orders?", "note25"],
  [false, "Como eu configurei o deploy da última vez?", "note26"],
  [false, "What is my preferred code style for React components?", "note27"],
  [false, "Apply the same retry policy we used in the payments service.", "note28"],
  [false, "Sugere um treino respeitando minha lesão no joelho.", "note29"],
  [false, "What are my dietary restrictions again?", "note30"],
]

export const relevanceFixture: RelevanceExample[] = withHoldout(
  pairs.map(([positive, message, key]) => ({ message, candidate: notes[key], positive })),
)
