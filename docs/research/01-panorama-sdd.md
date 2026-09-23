# 01 — Como a comunidade documenta para a LLM "não se perder"

> Estudo de 2026-09-23. Síntese dos anexos [A — toolkits](anexos/A-sdd-toolkits.md) e [B — práticas e fluxos](anexos/B-sdd-workflows.md), que trazem mais detalhes e todas as fontes.
> Os exemplos marcados como **ilustrativos** foram escritos por nós para mostrar a forma de cada artefato; não são cópia dos templates originais.

## Resposta curta

Sim. O movimento tem nome: **Spec-Driven Development (SDD)**, sustentado por um conceito mais amplo, **context engineering**.

- O Thoughtworks Radar (abr/2026) colocou *context engineering* em **Adopt**.
- As ferramentas de SDD (Spec Kit, OpenSpec) aparecem em **Assess**.

A ideia central é simples: **o que precisa sobreviver entre sessões mora em arquivos versionados, não na conversa.** O agente entrevista você, escreve uma spec curta e só depois implementa. A implementação acontece numa sessão nova, tarefa por tarefa, deixando rastro em um arquivo de estado e no git.

## Os 7 padrões que se repetem em todas as abordagens

Toolkit por toolkit, os detalhes mudam, mas o esqueleto é o mesmo. Cada padrão abaixo mostra a forma em código.

### 1. Arquivo de regras persistente, curto e escrito por humano

O pi e o Claude Code leem o `AGENTS.md` nativamente.
- **Claude Code:** desde a v2.1.277, lê o `AGENTS.md` quando não há `CLAUDE.md`. Com os dois, use `@AGENTS.md` dentro do `CLAUDE.md`. No Windows, prefira esse import a symlink.
- **pi:** carrega `AGENTS.md`/`CLAUDE.md` de `~/.pi/agent/`, dos diretórios pais e do cwd.

```markdown
<!-- AGENTS.md — ilustrativo: só o que o agente NÃO deduz do código -->
# AGENTS.md
## Regras de processo (obrigatórias)
- NÃO edite código de produção sem spec com `status: approved` em docs/specs/.
- Feature nova ou mudança em > 2 arquivos: entreviste o usuário primeiro (uma pergunta por vez).
- Início de sessão: leia docs/STATE.md, rode `git log --oneline -15`, pegue a próxima tarefa não marcada.
- Fim de tarefa: rode os testes, MOSTRE a saída, marque o checkbox, atualize STATE.md, commit.
- A realidade divergiu da spec? PARE e pergunte. A spec é corrigida antes do código.
## Comandos
- Testes: `pnpm test` · Tipos: `pnpm typecheck`
```

> **Evidência:** o estudo da ETH Zurich (arXiv 2602.11988, 2026) concluiu que arquivos de contexto **não melhoram** a taxa de sucesso em geral e **custam mais de 20% a mais** em inferência. A visão geral do repositório não ajuda; instruções específicas e não óbvias são seguidas. A lição é **arquivo mínimo**, escrito por você e com regras, não com um tour do código.

### 2. Entrevista antes da spec

Há três estilos consagrados:

| Estilo | Onde aparece | Como funciona |
|---|---|---|
| **Uma pergunta por vez** | Harper Reed, Superpowers, Spec Kit `/clarify` | Cada pergunta nasce da resposta anterior, de preferência em múltipla escolha |
| **Rodadas com resposta recomendada** | Matt Pocock `grill-me`, GSD | Pergunta toda a "fronteira" de decisões de uma vez, numeradas, cada uma com uma recomendação |
| **Suposições com evidência** | GSD (*assumptions mode*), HumanLayer | O agente lê o código, propõe suposições e você só confirma ou corrige (de 2 a 4 interações, contra 15 a 20) |

```text
# Prompt de entrevista — ilustrativo (paráfrase do padrão da Anthropic)
Quero construir <ideia>. Me entreviste em detalhe (use AskUserQuestion se disponível).
Cubra implementação, UX, casos de borda, riscos e tradeoffs. Não pergunte o óbvio.
Uma pergunta por vez, com opções e a sua recomendação.
Registre cada resposta. Ao final, escreva a spec completa em docs/specs/<tema>.md
e as dúvidas não resolvidas em docs/OPEN-QUESTIONS.md. Não escreva código.
```

### 3. Spec curta como fonte da verdade

A Anthropic recomenda uma spec **autocontida**: arquivos e interfaces nomeados, **fora de escopo explícito** e um **passo de verificação end-to-end**. Para os critérios de aceite, o formato mais adotado é o EARS, usado pelo Kiro e pelo cc-sdd.

```markdown
<!-- docs/specs/2026-09-23-salvar-memoria.md — ilustrativo -->
---
status: draft          # draft → approved (data + quem aprovou)
---
# Salvar memória no vault
## Objetivo · ## Dentro do escopo · ## Fora de escopo
## Requisitos
- R-01 WHEN o agente chamar memory_add THE sistema SHALL gravar a nota em <vault>/<pasta>.
- R-02 IF o arquivo tiver mudado desde a leitura THEN THE sistema SHALL abortar com CONFLICT.
- R-03 WHILE o OneDrive estiver pausado THE sistema SHALL continuar gravando localmente.
## Interfaces e arquivos (paths, assinaturas)
## Decisões (→ ADRs) · ## Questões em aberto (VAZIA antes de aprovar)
## Verificação end-to-end: `pnpm test:e2e` + checar a nota no Obsidian
```

### 4. Log de perguntas abertas + registro de decisões

```markdown
<!-- docs/OPEN-QUESTIONS.md — ilustrativo -->
| ID   | Pergunta                        | Opções (★ recomendada)      | Bloqueia? | Status    | Resolução |
|------|---------------------------------|-----------------------------|-----------|-----------|-----------|
| Q-01 | Um vault ou vários?             | 1★ / N via config           | 🔴 sim    | aberta    |           |
| Q-02 | Nome da pasta de memória        | "Agent Memory"★ / outro     | não       | delegada  | a critério do agente |
```

As decisões arquiteturais viram **ADR** no formato MADR 4.0 (`docs/decisions/NNNN-titulo.md`): contexto, opções, decisão e consequências. Regra comum: **uma pergunta 🔴 aberta impede aprovar a spec.**

### 5. Plano em tarefas pequenas, com checkbox e comando de verificação

```markdown
<!-- docs/specs/.../plan.md — ilustrativo (estilo Superpowers/GSD) -->
Goal: gravar memórias no vault com escrita segura.
Spec: docs/specs/2026-09-23-salvar-memoria.md
### Task 1: escrita com concorrência otimista
Files: src/storage/vault-writer.ts · tests/storage/vault-writer.test.ts
- [ ] Escrever teste falhando (conflito de hash)   → `pnpm vitest run tests/storage`  (esperado: FAIL)
- [ ] Implementar o mínimo                         → mesmo comando (esperado: PASS)
- [ ] Commit: "feat(storage): escrita com hash esperado"
```

### 6. Estado em arquivo + git + sessão nova por fase

```markdown
<!-- docs/STATE.md — ilustrativo (GSD usa < 100 linhas) -->
fase: F1-storage · active_spec: docs/specs/2026-09-23-salvar-memoria.md (approved)
active_plan: docs/specs/.../plan.md — 3/7 tarefas
próxima ação: Task 4 (detector de placeholder do OneDrive)
bloqueios: Q-07 (pin automático?) aguardando o usuário
última sessão: 2026-09-23 18:30 — ver docs/handoffs/2026-09-23_1830.md
```

A Anthropic descreve isso para agentes de longa duração assim:
- um *initializer agent* cria `feature_list.json` (o agente só pode mudar o campo `passes`), `claude-progress.txt` e `init.sh`;
- cada sessão seguinte **se situa**: lê o progresso e o `git log`, sobe o ambiente, faz um teste básico e trabalha **uma feature por vez**.

A HumanLayer recomenda manter o contexto entre **40% e 60%**, salvando o progresso em arquivo e recomeçando a sessão.

### 7. Verificação executável + gates determinísticos

"Parece pronto" não vale. Vale o comando de teste com a saída exibida. Instruções no `AGENTS.md` são *consultivas*; para "nunca faça X", use um **hook** (Claude Code) ou uma **extensão** (pi).

```jsonc
// .claude/settings.json — ilustrativo, não testado: bloqueia edição em src/ sem spec aprovada
{ "hooks": { "PreToolUse": [ { "matcher": "Edit|Write",
    "hooks": [ { "type": "command", "command": "node .claude/hooks/spec-gate.mjs" } ] } ] } }
// spec-gate.mjs lê docs/STATE.md → active_spec → exige "status: approved"; exit 2 = bloqueia e explica ao agente
```

---

## Toolkits e fluxos prontos: como são usados na prática

### GitHub Spec Kit (v1.0.10 · MIT · Python/uv · pi ✅ · Claude Code ✅)

O mais formal em "perguntar antes".

```bash
uv tool install specify-cli
specify init meu-projeto --integration claude
specify integration install pi            # gera .pi/prompts/speckit.*.md
```
```text
Fluxo completo (Claude: /speckit-X · pi: /speckit.X):
constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge

.specify/memory/constitution.md   ← princípios, lidos por todo comando
specs/001-salvar-memoria/{spec.md, plan.md, research.md, data-model.md, contracts/, tasks.md, checklists/}
```
- **`specify`:** faz "palpites informados" e deixa no máximo **3** marcadores `[NEEDS CLARIFICATION: …]`.
- **`clarify`:** até **5 perguntas, uma por vez**, com opção recomendada. As respostas ficam gravadas na spec em `## Clarifications → ### Session AAAA-MM-DD`.
- **`implement`:** **para e pergunta** se algum checklist estiver incompleto.
- **`converge`:** compara código e artefatos e acrescenta as tarefas que faltam, o que combate o *drift*.
- **Custo:** muito markdown. A Scott Logic mediu 2.577 linhas para uma feature, em versão anterior à 1.0.

### OpenSpec (v1.13.1 · MIT · Node · pi ✅ · Claude Code ✅)

O mais leve, com specs "vivas".

```bash
npm install -g @fission-ai/openspec@latest
openspec init --tools claude,pi           # Claude: /opsx:propose · pi: /opsx-propose
```
```text
/opsx:explore → /opsx:propose <nome> → (revisar) → /opsx:apply → /opsx:archive

openspec/
├── config.yaml                      ← context (injetado em todo planejamento) + rules por artefato
├── specs/<capability>/spec.md       ← FONTE DA VERDADE (comportamento atual)
└── changes/<id>/{proposal.md, design.md, tasks.md, specs/<cap>/spec.md (DELTA)}
    changes/archive/2026-09-23-<id>/ ← histórico datado
```
```markdown
<!-- delta spec — ilustrativo -->
## ADDED Requirements
### Requirement: Salvar memória
O sistema SHALL gravar a nota no vault configurado quando o agente chamar memory_add.
#### Scenario: arquivo alterado por outro dispositivo
- **WHEN** o hash atual difere do hash lido
- **THEN** a gravação é abortada com CONFLICT e nada é sobrescrito
```
- `openspec status --change X --json` diz o que está pronto ou bloqueado, o que ajuda a retomar.
- **Não tem gate rígido de perguntas:** `explore` nunca escreve código, e `propose` só pergunta se a ambiguidade for relevante. Compensa-se com `rules` no `config.yaml`.

### Kiro (AWS) — o formato vale mesmo sem a ferramenta (proprietário; não roda no pi nem no Claude Code)

```text
.kiro/steering/{product.md, tech.md, structure.md}   ← memória do projeto; inclusion: always|fileMatch|manual|auto
.kiro/specs/<feature>/{requirements.md (EARS), design.md, tasks.md (_Requirements: 1.1_)}
```
O **cc-sdd** replica esse fluxo para Claude Code e Codex, mas não suporta o pi. Vale copiar três ideias: **EARS**, **steering com inclusão condicional** e o bugfix com a seção "Unchanged Behavior".

### Superpowers (obra · v6.4.x · MIT · ~290k★ · pi ✅ · Claude Code ✅)

A melhor disciplina de "perguntar antes".

```bash
pi install git:github.com/obra/superpowers      # pi
# Claude Code: plugin via marketplace (ver README)
```
```text
brainstorming → using-git-worktrees → writing-plans → (subagent-driven-development | executing-plans)
→ test-driven-development → requesting-code-review → finishing-a-development-branch

docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md   ← design aprovado seção por seção
docs/superpowers/plans/AAAA-MM-DD-<feature>.md       ← tarefas de 2 a 5 min, com código, comando e commit
.superpowers/sdd/<plano>/progress.md                 ← ledger: "Task N: complete" = não refazer
```
- **Hard gate:** nenhum código, scaffold ou dependência antes do design aprovado.
- **Perguntas:** uma por mensagem, de preferência múltipla escolha.
- **Abordagens:** propõe 2 a 3 com tradeoffs e uma recomendação.
- **Classifica a tarefa** em *spike*, *bounded* ou *architectural* e ajusta a cerimônia; na dúvida, escolhe a mais pesada.

### GSD — "Get Shit Done" (hoje GSD Core v1.14 · MIT · pesado)

O que mais formaliza o nível de **projeto**.

```text
/gsd-new-project → /gsd-discuss-phase N → /gsd-plan-phase N → /gsd-execute-phase N → /gsd-verify-work N → /gsd-ship N
.planning/{PROJECT.md, REQUIREMENTS.md (IDs v1/v2/fora), ROADMAP.md, STATE.md (<100 linhas), HANDOFF.json}
.planning/phases/01-<nome>/{01-CONTEXT.md, 01-01-PLAN.md, 01-01-SUMMARY.md, 01-VERIFICATION.md, 01-UAT.md}
```
- O `CONTEXT.md` de cada fase separa três coisas: **decisões travadas**, o que fica **a critério do agente** e as **ideias adiadas**.
- O repositório original foi arquivado em jun/2026.
- Há churn: o GSD 2 (`gsd-pi`) virou uma CLI própria, construída sobre o SDK do pi.

### HumanLayer — Research → Plan → Implement (2025) e QRSPI (2026)

```text
thoughts/shared/{research/, plans/, handoffs/}      ← artefatos fora do código
/research_codebase → /create_plan → /implement_plan (marca checkboxes no plano; PARA se a realidade divergir)
```
- **Hierarquia de alavancagem:** uma linha ruim de pesquisa vira milhares de linhas ruins de código. Por isso a revisão humana vai para a pesquisa e o plano.
- **Autocrítica de 2026:** planos de cerca de 1.000 linhas **não são lidos**.
- **Fluxo novo (QRSPI):** perguntas → pesquisa "cega" → **design discussion de ~200 linhas**, que vira o principal ponto de revisão → fatias verticais → **o humano lê o código**.

### Harper Reed — o fluxo mínimo que funciona em qualquer agente

```text
1. "Faça-me UMA pergunta por vez para construirmos uma spec detalhada desta ideia…"  → spec.md
2. "Quebre a spec em passos pequenos e gere um prompt de implementação (TDD) por passo" → prompt_plan.md
3. "Crie um checklist minucioso"                                                    → todo.md
4. Execução: "abra prompt_plan.md, faça o próximo item não concluído, teste, commit, marque"
```
Mario Zechner, criador do pi, recomenda o mesmo: o pi **não tem** plan mode nem to-do embutidos **de propósito**, e o plano deve ficar em `PLAN.md`/`TODO.md`.

### Outros, em uma linha cada

| Nome | Artefatos | Nota |
|---|---|---|
| **BMAD** (v6.12, pi ✅) | `_bmad-output/`, PRD, `SPEC.md` (Why/Capabilities/Constraints/Non-goals/Success), `sprint-status.yaml` | Completo e com personas; pesado e com churn |
| **Agent OS** v3 | `agent-os/{product,standards,specs}/` | Virou "standards + `/shape-spec`"; só Claude Code |
| **Task Master** | PRD → `tasks.json` (`next`, dependências) | Parado desde abr/2026; Commons Clause; sem pi |
| **PRP** (Cole Medin) | `INITIAL.md` → `/generate-prp` → `PRPs/<feat>.md` → `/execute-prp` | Ótimo em contexto curado e validação em níveis; fraco em entrevista |
| **Cline Memory Bank** | `memory-bank/{projectbrief, productContext, systemPatterns, techContext, activeContext, progress}.md` | "Leia TUDO no início": simples, mas não escala |
| **Tessl** (tile) | `.spec.md` com links `[@test]` | Boa ideia: rastrear requisito → teste |
| **pi-sdd-kit** | `.ai/steering`, `.ai/sdd/specs`, `.status` | Nativo do pi, mas imaturo (~29★) |

---

## E o que muda quando o problema é um **projeto**, não uma feature?

Os toolkits por feature (Spec Kit, OpenSpec, Superpowers) pressupõem que o projeto já existe. Para um projeto novo com vários subsistemas, como o de memória, acrescenta-se uma **camada de projeto** antes. Ela aparece no GSD, no BMAD e no initializer da Anthropic:

```text
Pesquisa (este estudo) → Visão → Requisitos com ID (v1 / v2 / fora) → Arquitetura curta + ADRs
→ Roadmap em fases → [por fase: entrevista → spec curta → plano → sessão nova implementa → verificação]
```

A proposta concreta para o seu caso está em [05-proposta-reaproveitamento.md](05-proposta-reaproveitamento.md).
