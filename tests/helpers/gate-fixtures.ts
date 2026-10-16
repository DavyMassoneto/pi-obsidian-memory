import { type HoldoutMarked, withHoldout } from "./threshold-report.ts"

export interface GateCase {
  message: string
  project: string | null
  folder: string
  positive: boolean
}

export type GateExample = GateCase & HoldoutMarked

function gate(positive: boolean, project: string | null, folder: string, messages: string[]): GateCase[] {
  return messages.map((message) => ({ message, project, folder, positive }))
}

const gateCases: GateCase[] = [
  ...gate(true, "shop", "src/checkout", [
    "Qual gerenciador de pacotes uso neste projeto?",
    "Set up the test runner the way I like it.",
    "Escreve o commit message no formato que eu costumo usar.",
    "Which database did we pick for orders, and why?",
    "Use the same naming convention we agreed on for the API routes.",
    "Como eu configurei o deploy da última vez?",
    "Remind me what I decided about error handling in this module.",
    "Faz o import do jeito que combinamos para os alias de pasta.",
    "What is my preferred code style for React components?",
    "Continue de onde paramos ontem na migração do banco.",
    "Which linter rules did we turn off, and for what reason?",
    "Responde em português, como sempre peço.",
    "Add the new endpoint following our usual pattern.",
    "Qual era mesmo o prazo que o cliente deu para a fase dois?",
    "Apply the same retry policy we used in the payments service.",
  ]),
  ...gate(true, null, "notes", [
    "Quais livros eu disse que queria ler este ano?",
    "What are my dietary restrictions again?",
    "Planeja a viagem considerando minhas preferências de hotel.",
    "Draft the email in the tone I normally use with my manager.",
    "Qual é o nome da minha irmã mais nova?",
    "Which editor and keybindings do I use?",
    "Sugere um treino respeitando minha lesão no joelho.",
    "What time do I usually go running?",
    "Lembra qual foi o orçamento que defini para o notebook novo?",
    "Order lunch the way I usually do on Fridays.",
    "Qual fuso horário eu uso para marcar reuniões?",
    "What did I tell you about my cat's allergies?",
    "Reserva a sala com o setup que eu prefiro.",
    "Resume o artigo e foca nos temas que me interessam.",
    "Which languages am I learning right now?",
  ]),
  ...gate(false, "shop", "src/checkout", [
    "What is the difference between let and const in JavaScript?",
    "Quanto é 17 vezes 23?",
    "Translate 'good morning' into French.",
    "Explica o que é um índice em banco de dados.",
    "Write a regex that matches a 5-digit ZIP code.",
    "Qual a capital da Austrália?",
    "What does HTTP status 418 mean?",
    "Converte 100 graus Fahrenheit para Celsius.",
    "How do I reverse a string in Python?",
    "Explica a diferença entre TCP e UDP.",
    "What is the time complexity of binary search?",
    "Quem escreveu Dom Casmurro?",
    "Give me a synonym for 'ephemeral'.",
    "O que significa a sigla CRUD?",
    "How many bytes are in a kilobyte?",
  ]),
  ...gate(false, null, "notes", [
    "Qual é a raiz quadrada de 144?",
    "Summarize the plot of Romeo and Juliet in two sentences.",
    "Como se diz 'obrigado' em japonês?",
    "What is the boiling point of water at sea level?",
    "Explica como funciona a fotossíntese.",
    "List three common git branching strategies.",
    "Quantos dias tem fevereiro em um ano bissexto?",
    "What is the capital of Canada?",
    "Corrige a gramática: 'eles foi ao mercado'.",
    "Define the word 'idempotent'.",
    "Quem pintou a Mona Lisa?",
    "What is the speed of light in a vacuum?",
    "Escreve um haiku sobre a chuva.",
    "How do I center a div with CSS?",
    "Qual é a diferença entre 'affect' e 'effect'?",
  ]),
]

export const gateFixture: GateExample[] = withHoldout(gateCases)
