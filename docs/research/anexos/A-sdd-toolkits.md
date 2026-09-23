# A — Toolkits prontos de SDD (Spec-Driven Development) para agentes de código

**Panorama em 23/09/2026 — foco em uso com pi (pi.dev) e Claude Code, solo dev, plugin/extensão TypeScript**

---

## 0. Como ler este relatório

- **Data da pesquisa:** 2026-09-23. Números de GitHub stars foram lidos via `api.github.com` nesta data (valores aproximados). Versões e datas de release vêm da API de releases do GitHub ou do changelog oficial de cada produto.
- **Método:** leitura de READMEs, templates e prompts via `raw.githubusercontent.com`, API do GitHub, sites oficiais de documentação e artigos de crítica. Nada foi instalado, clonado ou executado.
- **Confiabilidade:** as páginas foram lidas por um extrator automático. As afirmações mais importantes (limites de perguntas, caminhos de arquivos, gates) foram **reconfirmadas com citação literal** do arquivo-fonte. Onde isso não foi possível, marquei **"não verificado"**.
- **"Exemplo ilustrativo"** = conteúdo escrito por mim para mostrar a *forma* do artefato. **Não** é texto copiado dos templates. A feature fictícia usada em todos os exemplos é "salvar uma nota de memória": um comando `/lembrar <texto>` de uma extensão TypeScript que grava notas curtas para o agente consultar em sessões futuras.
- Os termos técnicos ficaram em inglês.

### Sumário

1. Resumo executivo
2. Tabela comparativa
3. Contexto: pi e Claude Code como "hosts" + taxonomia de SDD
4. Toolkits
   - 4.1 GitHub Spec Kit
   - 4.2 OpenSpec (OPSX)
   - 4.3 Kiro (AWS): specs + steering
   - 4.4 BMAD Method
   - 4.5 Agent OS
   - 4.6 Claude Task Master
   - 4.7 cc-sdd (resumido)
   - 4.8 Tessl (resumido)
   - 4.9 Outros proeminentes em 2026: Superpowers, GSD Core, gstack, Conductor, pi-sdd-kit, etc.
5. Críticas transversais ao SDD (2025–2026)
6. Recomendações para o seu cenário
7. Mecanismos reaproveitáveis, caso você monte um fluxo próprio
8. Itens não verificados
9. Fontes consolidadas

---

## 1. Resumo executivo

- O ecossistema amadureceu e mudou muito em 2026:
  - **Spec Kit** chegou à **v1.0** em 21/08/2026. As etapas agora são "skills" (`/speckit-specify`), entrou o passo novo `/speckit-converge` e surgiram processos extras (bug e assess).
  - **OpenSpec** chegou à **v1.0** em 26/01/2026 com o fluxo **OPSX** (`/opsx:*`), baseado em "actions, not phases". Os comandos legados `/openspec:proposal|apply|archive` foram removidos.
  - **BMAD** está na **v6.12**. A v7 já está em preview no `main`, distribuída via `npx skills add`.
  - **Agent OS v3** abandonou o pipeline de spec/tasks/implementação e virou um sistema de *standards* + `/shape-spec` em plan mode.
  - **Task Master** desacelerou: último release em 31/03/2026, e o foco da empresa migrou para o Hamster.
- **Suporte a pi.** Três toolkits suportam pi **oficialmente**:
  - Spec Kit: `--integration pi` gera `.pi/prompts/speckit.*.md`.
  - OpenSpec: `--tools pi` gera `.pi/skills` + `.pi/prompts`, desde a v1.2.0.
  - BMAD: `--tools pi` instala em `.agents/skills`, pasta que o pi lê.

  Entre os "outros", **Superpowers** também suporta pi (`pi install git:github.com/obra/superpowers`), e **GSD Core** também (flag `--pi`, documentada no branch `next`). Não suportam pi: Kiro (produto fechado), Agent OS (só Claude Code), Task Master (sem perfil de pi, mas o CLI é usável por qualquer agente com shell) e cc-sdd.
- **Perguntas antes do código.** Mecanismos mais explícitos:
  - Spec Kit: `[NEEDS CLARIFICATION]` (no máximo 3 no specify) + `/speckit-clarify` (no máximo 5 perguntas, **uma por vez**, com opção recomendada, respostas gravadas em `## Clarifications` na própria spec). O checklist incompleto faz o `/speckit-implement` parar e perguntar.
  - Superpowers: *hard gate* de brainstorming, uma pergunta por mensagem, preferência por múltipla escolha e aprovação por seção.
  - Kiro: gates de aprovação por fase + "Analyze Requirements".
  - OpenSpec: é o mais leve, com `/opsx:explore` como parceiro de pensamento, mas não tem gate rígido ("enablers, not gates").
- **Contexto entre sessões.** Todos persistem em arquivos versionáveis:
  - constitution/steering/config com contexto do projeto;
  - pasta por feature ou mudança;
  - checklists de tasks.

  Os melhores mecanismos de "retomada" são: `openspec status/instructions --json` (progresso N/M), `sprint-status.yaml` do BMAD, `STATE.md`/`HANDOFF.json` + `/gsd-resume-work` do GSD e o *ledger* do Superpowers.
- **Críticas recorrentes:**
  - excesso de markdown para revisar (Scott Logic mediu ~2,5k linhas de markdown por feature com Spec Kit pré-1.0 e um fluxo ~10x mais lento);
  - "waterfall reinventado";
  - *spec drift* sem solução automática;
  - custo de tokens (BMAD);
  - "marreta para quebrar noz" em tarefas pequenas.

  A tendência de 2026 é **escalar a cerimônia ao tamanho da tarefa**: BMAD 6.12 Build, Superpowers 6.3, Kiro Quick Spec, o "shorter path" do Spec Kit e o perfil `core` do OpenSpec.
- **Para o seu caso** (solo, plugin TS, pi + Claude Code), a recomendação principal é **OpenSpec**. A alternativa, se você quiser gates formais de clarificação, é **Spec Kit**. **Superpowers** vale como referência de disciplina para "perguntar antes". Detalhes na seção 6.

---

## 2. Tabela comparativa

| Ferramenta | Peso/overhead | Agentes suportados (pi?) | Como faz perguntas antes do código | Como mantém o contexto entre sessões | Licença | Versão/data |
|---|---|---|---|---|---|---|
| **GitHub Spec Kit** | Médio-alto. O "full path" tem 9 passos; o "shorter path" tem 5. | ~40–50 integrações. Claude via `.claude/skills` (`/speckit-*`). **pi oficial** via `.pi/prompts` (`/speckit.*`). Tem ainda `omp` (Oh My Pi) e `generic`. | `[NEEDS CLARIFICATION]` (no máximo 3) no specify; `/speckit-clarify` (até 5 perguntas, uma por vez, com recomendação, registradas na spec); checklist bloqueia o implement; analyze é read-only. | `.specify/memory/constitution.md`, lido a cada comando; `.specify/feature.json` (feature ativa); `specs/NNN-*/`; `[X]` no `tasks.md`; `/speckit-converge` acrescenta tarefas faltantes. | MIT | v1.0.10 (22/09/2026) |
| **OpenSpec** | Baixo. Perfil `core`: propose → apply → archive. | 30+ ferramentas. Claude (`/opsx:*`). **pi oficial** desde v1.2.0 (`.pi/skills`, `.pi/prompts`, `/opsx-*`). Oh My Pi. Alvo neutro `.agents/skills`. | `/opsx:explore` (lê código, pergunta, nunca codifica); propose pergunta quando há ambiguidade material; seção *Open Questions* no design; sem gate rígido. | `openspec/config.yaml` (`context` injetado em todo pedido de planejamento); `specs/` como fonte da verdade; `changes/<id>/`; `archive/` datado; `openspec status/instructions --json`. | MIT | v1.13.1 (17/09/2026) |
| **Kiro (AWS)** | Médio (3 documentos + gates). Quick Spec reduz. | Só Kiro (IDE/CLI/Web). Não roda em pi nem em Claude Code; o formato markdown é portável. | Gate de aprovação por fase; *Analyze Requirements* (perguntas sobre conflitos e ambiguidades); Quick Spec pergunta antes de gerar. | Steering (`product.md`, `tech.md`, `structure.md` + inclusion modes); provedor `#spec`; status das tasks; "Sync Files". | Proprietário (free tier + planos de US$20 a US$200/mês) | IDE 1.1 (14/09/2026); CLI 2.22.0 (16/09/2026) |
| **BMAD Method** | Alto (personas, PRD, arquitetura, épicos). A v6.12 escala a cerimônia. | 48 plataformas. Claude (`.claude/skills`). **pi** via `--tools pi` (instala em `.agents/skills`). | forge-idea, brainstorming, advanced elicitation; PRD em "coaching path"; open questions no SPEC; `bmad-build` exige aprovação do plano quando há lacunas. | `_bmad-output/` + `sprint-status.yaml` (próxima ação recomendada); `bmad-help`; bloco de project context. | MIT + trademark | v6.12.0 (04/09/2026); v7 em preview |
| **Agent OS** | Baixo-médio (foco em *standards*). | Claude Code (commands). Outros agentes só referenciando o markdown manualmente. pi: não. | `/shape-spec` em plan mode com AskUserQuestion, uma pergunta por vez; `/plan-product`; entrevista em `/discover-standards`. | `agent-os/standards/` + `index.yml`; `agent-os/product/`; `agent-os/specs/<data-slug>/`. | MIT | v3.0.0 (20/01/2026) |
| **Task Master** | Médio (PRD → JSON de tasks; exige API key ou provider Claude Code/Codex). | 14 perfis de regras, sem pi. MCP. O CLI serve para qualquer agente com shell. | Fraco: depende da qualidade do PRD; `research` e `analyze-complexity`; não há passo formal de clarificação. | `tasks.json` + `next` + dependências + tags por branch + logs via `update-subtask`. | MIT + Commons Clause | v0.43.1 (31/03/2026), pouca atividade |
| **cc-sdd** | Médio (estilo Kiro + validações). | 8 agentes (Claude e Codex estáveis). pi: não. | `/kiro-discovery`; gates por fase; `/kiro-validate-gap`, `/kiro-validate-design`, `/kiro-validate-impl`. | `.kiro/steering/`, `spec.json`, `brief.md`/`roadmap.md`. | MIT | v3.0.2 (13/04/2026) |
| **Tessl** (tile SDD) | Tile leve; o framework da plataforma está em beta fechado. | Agentes com MCP (Claude Code, Cursor). pi: não verificado. | Regras `spec-before-code` e `one-question-at-a-time` + skill `requirement-gathering`. | `.spec.md` com `targets` + links `[@test]`, em `.tessl/`. | Tile MIT; plataforma comercial | tile 2.0.1 |
| **Superpowers** | Médio. Escala conforme o tamanho da tarefa; o modo com subagentes custa mais. | Muitos harnesses. Claude (plugin). **pi** (`pi install git:github.com/obra/superpowers`). | Brainstorming com *hard gate*; uma pergunta por mensagem, de preferência múltipla escolha; 2–3 abordagens; aprovação seção a seção. | `docs/superpowers/specs/` e `docs/superpowers/plans/`; ledger `.superpowers/sdd/<plano>/progress.md`. | MIT | v6.4.1 (19/09/2026) |
| **GSD Core** | Alto (fases, subagentes, muitos artefatos). | ~17 runtimes. Claude. **pi** via `--pi` (extensão; documentado no branch `next`). | `/gsd-new-project` (perguntas); `/gsd-discuss-phase` ("lock in preferences"). | `.planning/STATE.md`, `HANDOFF.json`, `/gsd-resume-work`, `/gsd-progress`. | MIT | v1.14.0 (14/09/2026) |

---

## 3. Contexto: pi e Claude Code como "hosts" + taxonomia

### 3.1 Como o pi carrega instruções (relevante para "suporta pi?")

- **O que é o pi hoje:** pacote `@earendil-works/pi-coding-agent`, repositório `earendil-works/pi` (antes `badlogic/pi-mono`), mantido pela Earendil Inc. com Mario Zechner. Fontes: [pi.dev](https://pi.dev/) e o código da integração pi do Spec Kit, que aponta para esse pacote npm.
- **Prompt templates:** cada `.md` num diretório de prompts do usuário ou do projeto vira um slash command (`/nome`), com `$ARGUMENTS`, `$1`, `${1:-default}`. Os toolkits usam `.pi/prompts/`. Fonte: [pi docs – prompt templates](https://pi.dev/docs/latest/prompt-templates).
- **Skills (padrão Agent Skills / `SKILL.md`):** `~/.pi/agent/skills/`, `.pi/skills/` e também `~/.agents/skills/` e `.agents/skills/`, descobertos do cwd até a raiz do git. Invocação por `/skill:nome` ou carregamento automático. Fontes: [pi docs – skills](https://pi.dev/docs/latest/skills) e [earendil-works/pi skills.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).
- **Contexto:** suporta `AGENTS.md` (e `SYSTEM.md`). Fonte: [pi.dev](https://pi.dev/).
- **Lacunas intencionais:** não tem *plan mode*, *sub-agents*, MCP nem *permission popups* nativos; tudo isso vem via extensões/pacotes. Exemplos no catálogo: `@narumitw/pi-plan-mode` e `@juicesharp/rpiv-todo`. O catálogo mostrava 5.723 pacotes. Fontes: [pi.dev](https://pi.dev/) e [pi.dev/packages](https://pi.dev/packages).
- **Implicação prática:** toolkits que dependem de **MCP** degradam no pi (Task Master em modo MCP, `taskstoissues` do Spec Kit, Tessl). O mesmo vale para os que dependem de **subagentes** (`/kiro-impl` do cc-sdd, GSD, `subagent-driven-development` do Superpowers) e de **plan mode + AskUserQuestion** (Agent OS). Nesses casos é preciso usar pacotes complementares ou um modo "inline".

### 3.2 Taxonomia útil (Birgitta Böckeler, Thoughtworks, 15/10/2025)

- **Spec-first:** a spec é escrita antes do código e descartada depois.
- **Spec-anchored:** a spec persiste e evolui junto com a feature.
- **Spec-as-source:** humanos editam só a spec; o código é "gerado".
- Onde cada ferramenta se encaixa:
  - Spec Kit: na prática, spec-first por feature (o próprio guia pede que você decida "como as specs envelhecem").
  - OpenSpec: spec-anchored (as deltas são mescladas em `openspec/specs/`).
  - Tessl: persegue spec-as-source.

Fonte: [martinfowler.com – Understanding SDD: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).

---

## 4. Toolkits

### 4.1 GitHub Spec Kit (`github/spec-kit`)

#### Identidade e maturidade
- **Mantenedor:** GitHub. Criado por Den Delimarsky e John Lam em 21/08/2025. Manfred Riem é o *lead maintainer* desde 22/01/2026. São 270+ contribuidores.
- **Licença:** MIT.
- **Números:** ~138k stars e ~12,4k forks.
- **Versão:** última **v1.0.10 (22/09/2026)**. A **v1.0.0 saiu em 21/08/2026**, no aniversário de 1 ano. O ritmo de releases é quase diário.
- **Requisitos:** Python 3.11+, `uv`. Roda em Linux, macOS e Windows, com scripts em bash, PowerShell e Python. A v1.0.2 corrigiu UTF-8 no PowerShell do Windows.
- **Linha do tempo:**
  - fev–abr/2026: sistema de extensões, presets, integrações via registry e workflow engine;
  - jun–jul/2026: extensões first-party `bug` (v0.9.5) e `assess` (v0.13.0);
  - ago/2026: 1.0 com 38 integrações, 157 extensões comunitárias e 33 presets.

#### Agentes e pi
- **Quantidade de integrações:** as docs citam 38 no 1.0 e "50+" na página de referência; o catálogo atual tem 45 entradas.
- **Claude Code:** key `claude`, modo skills, arquivos em `.claude/skills/speckit-<cmd>/SKILL.md`, invocação `/speckit-<cmd>`.
- **pi (oficial):** key `pi`, arquivos em `.pi/prompts/speckit.<cmd>.md` (formato markdown, argumentos via `$ARGUMENTS`), invocação `/speckit.<cmd>`. A integração declara `multi_install_safe = True` e `requires_cli: True`.
  - Nota oficial: o pi não tem MCP nativo, então `taskstoissues` não funciona como esperado.
- **Também há:** `omp` (Oh My Pi → `.omp/commands`) e `generic` (qualquer agente: `--integration-options="--commands-dir <dir>"`, com `--skills` para layout de skills).
- **Multi-install:** `specify integration install <key>`. Integrações "multi-install safe" coexistem.

#### Instalação e init
```bash
uv tool install specify-cli
specify init meu-plugin --integration claude     # projeto novo
cd meu-plugin
specify integration install pi                   # adiciona pi (ambas multi-install safe)

# projeto existente (brownfield), na raiz, após commitar/stash:
specify init --here --force --integration claude

# manutenção
specify self upgrade
specify integration upgrade claude
specify extension add bug      # processo opcional de bug fixing
specify extension add assess   # processo opcional de avaliação de ideia
```
Outros subcomandos do CLI: `check`, `extension`, `preset`, `workflow`, `integration`, `artifact`, `upgrade`.

#### Workflow (nomes atuais; no pi use `.` no lugar de `-`, por exemplo `/speckit.specify`)
- **Shorter path:** `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`.
- **Full path (com gates de qualidade):**
  1. `/speckit-constitution`: princípios do projeto (uma vez).
  2. `/speckit-specify <o quê e por quê>`: cria `specs/NNN-slug/spec.md` + `checklists/requirements.md`.
  3. `/speckit-clarify`: resolve ambiguidades. **Rodar antes do plan.**
  4. `/speckit-plan <stack/arquitetura>`: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.
  5. `/speckit-checklist <domínio>`: checklists de qualidade de requisitos ("unit tests for English").
  6. `/speckit-tasks`: `tasks.md`.
  7. `/speckit-analyze`: consistência entre artefatos (read-only).
  8. `/speckit-implement`: executa as tasks e marca `[X]`.
  9. `/speckit-converge`: compara código × artefatos e acrescenta tarefas faltantes.
  - Extra: `/speckit-taskstoissues` (exige o MCP do GitHub).
- **Recomendação oficial:** invocar um passo por vez e revisar o resultado antes do próximo.

#### Estrutura de pastas
```text
meu-plugin/
├── .specify/
│   ├── memory/
│   │   └── constitution.md          # lida "ao vivo" por todos os comandos
│   ├── scripts/{bash,powershell,python}/   # create-new-feature, setup-plan, setup-tasks,
│   │                                        # check-prerequisites, resolve-template, common
│   ├── templates/                   # spec/plan/tasks/checklist/constitution (overrides locais)
│   ├── init-options.json            # ex.: numeração "sequential" (NNN) ou "timestamp"
│   ├── feature.json                 # caminho da feature ativa (para retomar)
│   └── extensions.yml               # hooks before_*/after_* de extensões
├── specs/
│   └── 001-salvar-nota-memoria/
│       ├── spec.md
│       ├── checklists/requirements.md   (+ ux.md, api.md, security.md…)
│       ├── plan.md
│       ├── research.md
│       ├── data-model.md
│       ├── quickstart.md
│       ├── contracts/
│       └── tasks.md
├── .claude/skills/speckit-*/SKILL.md    # integração claude
└── .pi/prompts/speckit.*.md             # integração pi
```
- O nome do diretório da spec e o nome do branch git são independentes. O branching é opcional, via hook ou extensão `git`.

#### Conteúdo dos artefatos (seções dos templates)
- **`constitution.md`:**
  - `# [PROJECT_NAME] Constitution`;
  - `## Core Principles` com 5 princípios placeholder;
  - duas seções livres (restrições; processo/quality gates);
  - `## Governance`;
  - rodapé com Version / Ratified / Last Amended (versionamento semântico).
  - Desde a 1.0 a constitution **não é mais propagada** para os templates: é lida em runtime. O comportamento antigo volta via preset `constitution-sync`.
- **`spec.md`:**
  - cabeçalho: Feature Branch, Created, Status, Input;
  - `User Scenarios & Testing` (*mandatory*): user stories priorizadas P1/P2/P3, cada uma com "Why this priority", "Independent Test" e "Acceptance Scenarios" Given/When/Then; mais `Edge Cases`;
  - `Requirements` (*mandatory*): `FR-###` com marcadores `[NEEDS CLARIFICATION: …]`; `Key Entities`;
  - `Success Criteria` (*mandatory*): `SC-###` mensuráveis e agnósticos de tecnologia;
  - `Assumptions`;
  - `## Clarifications` / `### Session YYYY-MM-DD` é criado pelo clarify.
- **`plan.md`:**
  - Summary;
  - **Technical Context** (Language/Version, Primary Dependencies, Storage, Testing, Target Platform, Project Type, Performance Goals, Constraints, Scale/Scope; cada campo pode ficar "NEEDS CLARIFICATION");
  - **Constitution Check** (gate antes da Phase 0 e rechecado após a Phase 1);
  - Project Structure (layouts: single / web / mobile+API);
  - **Complexity Tracking** (justifica violações da constitution).
- **`tasks.md`:**
  - formato `- [ ] T001 [P] [US1] Descrição com caminho de arquivo` (`[P]` = paralelizável);
  - fases: Setup → Foundational (bloqueante) → uma fase por user story (com Checkpoint de teste independente) → Polish;
  - seções "Dependencies & Execution Order", "Parallel Opportunities" e "Implementation Strategy" (MVP primeiro).
- **Checklists (`checklists/<domínio>.md`):**
  - itens `- [ ] CHK001 - <pergunta sobre a qualidade do requisito>? [Dimensão, Spec §X.Y | Gap | Ambiguity]`;
  - proíbem linguagem de teste de implementação ("Verify", "Click").

#### Exemplo ilustrativo — `specs/001-salvar-nota-memoria/spec.md` (resumido)
```markdown
# Feature Specification: Salvar nota de memória

**Feature Branch**: `001-salvar-nota-memoria`   **Created**: 2026-09-23   **Status**: Draft
**Input**: "Quero um comando /lembrar que guarde uma nota curta para o agente usar nas próximas sessões"

## Clarifications
### Session 2026-09-23
- Q: As notas são globais do usuário ou por projeto? → A: Por projeto
- Q: Tamanho máximo da nota? → A: 500 caracteres

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Salvar uma nota (Priority: P1)
Como dev, quero salvar uma nota curta com `/lembrar` para que ela continue disponível depois que a sessão terminar.
**Why this priority**: sem persistência não existe memória entre sessões (é o MVP).
**Independent Test**: salvar uma nota, reiniciar o agente e ver a nota na listagem.
**Acceptance Scenarios**:
1. **Given** um projeto sem notas, **When** executo `/lembrar "usar pnpm"`, **Then** a nota aparece na próxima sessão.
2. **Given** um texto vazio, **When** executo `/lembrar ""`, **Then** recebo erro e nada é salvo.

### Edge Cases
- Armazenamento sem permissão de escrita → erro claro, notas antigas intactas.
- Nota idêntica a uma existente → [NEEDS CLARIFICATION: deduplicar, avisar ou salvar de novo?]

## Requirements *(mandatory)*
- **FR-001**: O sistema MUST persistir cada nota com identificador, texto e data de criação.
- **FR-002**: O sistema MUST rejeitar notas vazias ou com mais de 500 caracteres.
- **FR-003**: O sistema MUST NOT alterar ou apagar notas existentes ao salvar uma nova.
### Key Entities
- **Nota de memória**: identificador, texto, data de criação, tags (opcional).

## Success Criteria *(mandatory)*
- **SC-001**: 100% das notas salvas aparecem após reiniciar o agente.
- **SC-002**: Salvar uma nota leva menos de 200 ms percebidos pelo usuário.

## Assumptions
- Uso por um único usuário, sem sincronização entre máquinas.
```
Repare que a spec do Spec Kit é "tecnologia-agnóstica". Caminhos como `memory/notes.jsonl` e a escolha de JSONL entram no `plan.md` e no `data-model.md`, não aqui.

#### Exemplo ilustrativo — `tasks.md` (resumido)
```markdown
# Tasks: Salvar nota de memória

## Phase 1: Setup
- [ ] T001 Criar `src/memory/` e `tests/memory/`
- [ ] T002 [P] Configurar vitest em `vitest.config.ts`

## Phase 2: Foundational
- [ ] T003 Definir o tipo `MemoryNote` em `src/memory/types.ts`

## Phase 3: User Story 1 - Salvar uma nota (P1) — MVP
- [ ] T004 [P] [US1] Testes de validação (vazio, >500) em `tests/memory/validate.test.ts`
- [ ] T005 [P] [US1] Teste de gravação append-only em `tests/memory/store.test.ts`
- [ ] T006 [US1] Implementar `validateNote()` em `src/memory/validate.ts`
- [ ] T007 [US1] Implementar `appendNote()` em `src/memory/store.ts` (depende de T003)
- [ ] T008 [US1] Registrar o comando `/lembrar` em `src/index.ts`
**Checkpoint**: US1 funciona e é testável de forma independente

## Phase N: Polish & Cross-Cutting Concerns
- [ ] T009 [P] Documentar `/lembrar` no README
```

#### Como faz perguntas antes de codar (verificado literalmente nos prompts)
- **`/speckit-specify`:**
  - "Make informed guesses based on context and industry standards";
  - usa `[NEEDS CLARIFICATION]` só quando a escolha impacta muito escopo ou UX, **com limite de 3 marcadores**;
  - apresenta até 3 perguntas (Q1–Q3) com opções sugeridas em tabela;
  - gera `checklists/requirements.md` e valida a spec em até 3 passadas.
- **`/speckit-clarify`** (rodar antes do plan):
  - varre uma taxonomia de 9 categorias: escopo, dados, UX, NFR, integrações, edge cases, restrições, terminologia e sinais de conclusão;
  - faz **no máximo 5 perguntas**, "EXACTLY ONE question at a time";
  - usa múltipla escolha com "**Recommended:** Option X" ou resposta curta;
  - grava cada resposta em `## Clarifications` → `### Session YYYY-MM-DD` como `- Q: … → A: …` e integra a decisão na seção certa da spec, salvando após cada resposta;
  - o usuário pode encerrar com "done".
- **`/speckit-plan`:** campos "NEEDS CLARIFICATION" no Technical Context viram pesquisa na Phase 0 (`research.md`). A Constitution Check é gate.
- **`/speckit-checklist`:** faz até 3 perguntas de contexto (no máximo 5) antes de gerar.
- **`/speckit-implement`:** se algum checklist tiver itens não marcados, **para e pergunta** se deve prosseguir.
- **`/speckit-analyze`:** read-only. Faz 6 passes (duplicação, ambiguidade, subespecificação, alinhamento à constitution, lacunas de cobertura, inconsistência) com severidade CRITICAL, HIGH, MEDIUM ou LOW. Não aplica correções automaticamente.

#### Como mantém o agente orientado entre sessões
- **Constitution** em `.specify/memory/constitution.md`, lida a cada comando.
- **`.specify/feature.json`** guarda o caminho da feature ativa, então os comandos seguintes sabem em que `specs/NNN-*` trabalhar.
- **Artefatos por feature** em `specs/`.
- **Checkboxes `[X]`** no `tasks.md`: o implement marca cada tarefa concluída. Não achei instrução explícita de "pular tarefas já marcadas" ao retomar; o estado está implícito no arquivo (não verificado).
- **`/speckit-converge`:** acrescenta só `## Phase N: Convergence` ao `tasks.md`. Nunca edita spec ou plan nem renumera tarefas, e deixa o arquivo byte a byte igual se não houver lacunas.
- **Ressalva:** o Spec Kit **não** mantém uma "spec viva" do sistema inteiro. O guia de brownfield diz que não há descoberta automática do código existente e pede que você decida como as specs envelhecem (registros imutáveis, contratos vivos ou reconciliação).
- **Nota (inferência):** a pasta `scripts/bash` atual não tem mais o script de "update agent context" que existia em versões 0.x, e o código de integrações não gera AGENTS.md/CLAUDE.md. Para orientar o agente, aponte você mesmo no `AGENTS.md`/`CLAUDE.md` para `.specify/memory/constitution.md` e `specs/`.

#### Pontos fortes
- Gates de clarificação e consistência mais explícitos do mercado: clarify, checklist, analyze e converge.
- Enorme adoção.
- Suporte oficial a pi e Claude Code no mesmo repositório.
- Scripts para Windows.
- Customização por presets e extensões.

#### Fraquezas e críticas
- Verbosidade e overhead de revisão:
  - Scott Logic (nov/2025, pré-1.0) mediu 2.577 linhas de markdown para 689 linhas de código, 33min30 de agente e 3,5 h de revisão, contra 8 min pelo método iterativo ("~10x");
  - Böckeler: "tedious to review"; o workflow não se adapta ao tamanho do problema;
  - Thoughtworks: "lengthy spec files that are hard to review".
- Brownfield fraco (sem mapeamento do sistema).
- Specs por feature tendem a divergir do código ao longo do tempo. O `converge` só cobre a feature corrente.
- Dependência de Python/`uv`.
- Churn alto de versões: releases quase diários em set/2026.

#### Fit para solo dev (plugin TS pequeno)
- **Bom se** você quer exatamente "nada de código antes de responder as perguntas": use o full path com clarify e checklist.
- **Pesado** para mudanças pequenas. Use o shorter path, ou só specify → clarify → plan → tasks.

#### Fontes
- [API repo](https://api.github.com/repos/github/spec-kit) · [releases](https://api.github.com/repos/github/spec-kit/releases) · [README](https://raw.githubusercontent.com/github/spec-kit/main/README.md)
- [Docs](https://github.github.io/spec-kit/) · [Quickstart](https://github.github.io/spec-kit/quickstart.html) · [Integrations](https://github.github.io/spec-kit/reference/integrations.html) · [Reference overview](https://github.github.io/spec-kit/reference/overview.html) · [Existing projects](https://github.github.io/spec-kit/guides/existing-projects.html)
- [upgrade.md](https://raw.githubusercontent.com/github/spec-kit/main/docs/upgrade.md) · [history.md](https://raw.githubusercontent.com/github/spec-kit/main/docs/history.md)
- Templates: [spec](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md), [plan](https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md), [tasks](https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md), [constitution](https://raw.githubusercontent.com/github/spec-kit/main/templates/constitution-template.md)
- Comandos: [specify](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md), [clarify](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md), [plan](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/plan.md), [checklist](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/checklist.md), [analyze](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md), [implement](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/implement.md), [converge](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/converge.md), [constitution](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/constitution.md), [taskstoissues](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/taskstoissues.md)
- Integrações: [pi](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/pi/__init__.py), [base.py](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/base.py), [catalog.json](https://raw.githubusercontent.com/github/spec-kit/main/integrations/catalog.json) · [scripts/bash](https://github.com/github/spec-kit/tree/main/scripts/bash)
- Críticas: [Scott Logic](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.2 OpenSpec (`Fission-AI/OpenSpec`) — fluxo OPSX

#### Identidade e maturidade
- **Mantenedor:** Fission AI, criador Tabish Bidiwale (Sydney). A empresa está no Y Combinator W26, segundo LinkedIn/YC nos resultados de busca.
- **Licença:** MIT, sem tiers pagos.
- **Números:** ~70k stars e ~4,8k forks.
- **Versão:** **v1.13.1 (17/09/2026)**. A **v1.0.0 saiu em 26/01/2026**; os releases são semanais.
- **Instalação:** Node ≥ 20.19.0; npm `@fission-ai/openspec` (também brew, pnpm, bun).
- **Telemetria:** anônima e opt-out (`openspec config set telemetry.enabled false`).
- **Thoughtworks Radar (abr/2026):** OpenSpec em **Assess**, descrito como leve, baseado em deltas, adequado a sistemas existentes, "iterative and tool agnostic".

#### O que mudou no 1.x (OPSX)
- **v1.0.0:**
  - `/opsx:*` substitui `/openspec:proposal|apply|archive` (removidos);
  - skills (`.claude/skills/…`) substituem arquivos por ferramenta;
  - **deixam de ser gerados** `openspec/AGENTS.md`, `project.md`, `CLAUDE.md` e `.cursorrules`;
  - `project.md` passa a ser `openspec/config.yaml` (migração manual).
- **Filosofia "actions, not phases":** os artefatos formam um grafo de dependências (proposal → specs → design → tasks → apply → archive). As dependências são "enablers, not gates": dá para voltar e atualizar artefatos no meio da implementação.
- **v1.2.0 (23/02/2026):** perfis (`core` vs expanded), `/opsx:propose` em um passo, **suporte a Pi** e Kiro.
- **v1.6.0 (10/07/2026):** `/opsx:update` e suporte a Oh My Pi.
- **Depois:** `openspec show --diff` e `status --all` (1.11), findings reports (1.12), avisos no apply quando faltam delta specs (1.13).
- **Schemas customizáveis:** `openspec schema init|fork|validate`.
- **"Stores" (beta):** planejamento entre repositórios.

#### Agentes e pi
- **Cobertura:** 30+ ferramentas. Cada uma recebe skills (`SKILL.md`) e, quando há adaptador, também commands.

| Tool ID | Skills | Commands | Invocação |
|---|---|---|---|
| `claude` | `.claude/skills/openspec-*/SKILL.md` | `.claude/commands/opsx/<id>.md` | `/opsx:propose` |
| **`pi`** | `.pi/skills/openspec-*/SKILL.md` | `.pi/prompts/opsx-<id>.md` | `/opsx-propose` |
| `oh-my-pi` | `.omp/skills/openspec-*/SKILL.md` | `.omp/commands/opsx-<id>.md` | `/opsx-propose` |
| `agents` (neutro) | `.agents/skills/openspec-*/SKILL.md` | — | `/openspec-propose` |

- **Agnóstico de agente:** o CLI tem um "agent contract" com saídas `--json` estáveis, o que permite que qualquer agente com shell dirija o fluxo.

#### Instalação e init
```bash
npm install -g @fission-ai/openspec@latest
cd meu-plugin
openspec init --tools claude,pi      # cria openspec/{specs,changes,config.yaml} + skills/commands
openspec config profile              # opcional: habilita o perfil expandido
openspec update                      # regenera skills após upgrade ou mudança de perfil
```

#### Workflow (perfil `core`)
1. `/opsx:explore`: pensar junto, sem escrever código.
2. `/opsx:propose <nome>`: cria a change e todos os artefatos de planejamento (proposal, specs, design, tasks).
3. Revisar e editar os artefatos. `/opsx:update` revisa o plano mantendo a coerência.
4. `/opsx:apply`: implementa as tasks e marca `- [x]`.
5. `/opsx:sync`: opcional, mescla as delta specs nas specs principais antes de arquivar.
6. `/opsx:archive`: mescla as deltas e move para `changes/archive/YYYY-MM-DD-<nome>/`.

- **Perfil expandido:** `/opsx:new` (só scaffold), `/opsx:continue` (um artefato por vez, mostrando o que foi desbloqueado), `/opsx:ff` (fast-forward), `/opsx:verify` (implementação × artefatos), `/opsx:bulk-archive`, `/opsx:onboard` (tour guiado numa mudança real e pequena).
- **CLI útil para retomar e depurar:**
  - `openspec list`, `show [--diff]`, `view` (dashboard), `validate [--all] [--archived]`;
  - `status --change <id> [--json]`, `instructions <artefato|apply> --change <id> --json`;
  - `archive`, `new change`, `doctor`.

#### Estrutura de pastas
```text
meu-plugin/
├── openspec/
│   ├── config.yaml                  # schema + context (injetado em todo planejamento, limite 50KB) + rules por artefato
│   ├── schemas/                     # (opcional) schemas próprios
│   ├── specs/                       # FONTE DA VERDADE (comportamento atual)
│   │   └── memory-notes/spec.md
│   └── changes/
│       ├── add-memory-note/         # mudança em andamento
│       │   ├── .openspec.yaml       # metadados da change
│       │   ├── proposal.md
│       │   ├── design.md
│       │   ├── tasks.md
│       │   └── specs/memory-notes/spec.md   # DELTA spec
│       └── archive/
│           └── 2026-09-23-add-memory-note/  # histórico completo
├── .claude/skills/openspec-*/SKILL.md  (+ .claude/commands/opsx/)
└── .pi/skills/openspec-*/SKILL.md      (+ .pi/prompts/opsx-*.md)
```

#### Conteúdo dos artefatos (schema padrão `spec-driven`)
- **`proposal.md`:** `## Why`, `## What Changes`, `## Capabilities` (`### New Capabilities` / `### Modified Capabilities`, cada item vira `specs/<capability>/spec.md`) e `## Impact`.
  - Mudança sem capability (refactor, docs) precisa de `skip_specs: true` no `.openspec.yaml`.
- **Delta spec:**
  - `## Purpose` (só para capability nova);
  - `## ADDED | MODIFIED | REMOVED | RENAMED Requirements`;
  - `### Requirement: <nome>` com SHALL/MUST (RFC 2119);
  - pelo menos um `#### Scenario:` (exatamente 4 `#`) com **WHEN/THEN**;
  - MODIFIED precisa trazer o requisito completo, não parcial;
  - specs descrevem comportamento, não implementação.
- **`design.md`:** Context, Goals / Non-Goals, Decisions (com alternativas), Risks / Trade-offs, e quando aplicável Migration Plan e **Open Questions** ("only genuinely deferrable unknowns"). É opcional em mudanças simples.
- **`tasks.md`:** `# Tasks` → `## 1. <Grupo>` → `- [ ] 1.1 …`, com método de verificação por tarefa e "uma sessão por task quando possível". Só `x`/`X` conta como feito.
- **`config.yaml`:** `schema`, `context` (stack, convenções) e `rules` por artefato (por exemplo "specs: use Given/When/Then").

#### Exemplo ilustrativo — change `add-memory-note`
```markdown
<!-- openspec/changes/add-memory-note/proposal.md -->
# Proposal
## Why
O agente perde decisões entre sessões; precisamos registrar notas curtas explicitamente.
## What Changes
- Novo comando `/lembrar <texto>` que persiste a nota no projeto.
- Validação de tamanho (1–500 caracteres).
## Capabilities
### New Capabilities
- `memory-notes`: registro e persistência de notas de memória por projeto
### Modified Capabilities
- (nenhuma)
## Impact
- Novo módulo `src/memory/`; arquivo de dados `memory/notes.jsonl`; sem dependências novas.
```
```markdown
<!-- openspec/changes/add-memory-note/specs/memory-notes/spec.md -->
## Purpose
Permitir que o usuário registre notas curtas que persistem entre sessões do agente.

## ADDED Requirements
### Requirement: Salvar nota
O sistema SHALL persistir a nota com identificador, texto e data de criação quando o usuário executar `/lembrar`.

#### Scenario: Nota válida
- **WHEN** o usuário executa `/lembrar "usar pnpm"`
- **THEN** a nota é gravada e aparece na listagem da próxima sessão

#### Scenario: Nota vazia
- **WHEN** o usuário executa `/lembrar ""`
- **THEN** o sistema recusa com mensagem de erro e nada é gravado
```
```markdown
<!-- openspec/changes/add-memory-note/tasks.md -->
# Tasks
## 1. Modelo e validação
- [ ] 1.1 Criar o tipo `MemoryNote` (verificar: `tsc --noEmit`)
- [ ] 1.2 Implementar `validateNote()` com testes de vazio e >500 (verificar: `vitest run`)
## 2. Persistência e comando
- [ ] 2.1 Implementar `appendNote()` append-only em JSONL (verificar: teste com duas gravações)
- [ ] 2.2 Registrar `/lembrar` (verificar: execução manual no pi e no Claude Code)
```
Ao dar `/opsx:archive`, o requisito "Salvar nota" é mesclado em `openspec/specs/memory-notes/spec.md` e a pasta vai para `archive/2026-09-23-add-memory-note/`.

#### Como faz perguntas antes de codar (verificado literalmente)
- **`/opsx:explore`:** "thinking partner". Faz perguntas de clarificação, lê e busca no código, compara opções e trade-offs, faz diagramas e **nunca escreve código**. Recomenda trazer problemas, não soluções.
- **`/opsx:propose`:** "If the request contains ambiguity that would materially affect scope, externally observable behavior, compatibility, or acceptance criteria, ask the user before creating the change." Termina com "Do NOT implement the change…".
- **`/opsx:apply`:** "If task is ambiguous, pause and ask before implementing". Se a implementação revelar erro de design, sugere atualizar os artefatos.
- **Limitação:** não há gate formal equivalente ao clarify do Spec Kit. Você pode forçar isso com `rules` no `config.yaml` e com o hábito de sempre começar por `/opsx:explore`.

#### Como mantém o agente orientado entre sessões
- **`config.yaml`:** o `context` é "actively injected into every OpenSpec planning request".
- **`openspec/specs/`:** fonte da verdade, que cresce a cada archive.
- **Change folder com estado:**
  - `openspec status --change X --json` diz quais artefatos estão prontos ou bloqueados;
  - `openspec instructions apply --json` devolve os arquivos de contexto, o progresso "N/M tasks complete" e o estado (blocked, ready, all_done).
  - O apply "can be invoked anytime… after partial implementation", o que faz dele o mecanismo de retomada.
- **Histórico datado** em `archive/`.

#### Pontos fortes
- Leve.
- Pensado para brownfield: "You write specs only for what you're about to change". As specs acumulam com o tempo.
- Deltas deixam claro o que muda.
- Suporte nativo a pi e Claude Code.
- CLI com saída JSON robusta.
- Muito ativo.

#### Fraquezas e críticas
- Não há reconciliação automática spec↔código (*drift* manual), apontado em comparativos de 2026.
- Overkill para correções triviais.
- Formato de delta estrito (`####`, MODIFIED completo).
- Sem gate forte de "perguntas respondidas".
- Telemetria (opt-out).

#### Fit para solo dev (plugin TS)
- **Excelente.** É o melhor equilíbrio entre peso e benefício para quem usa pi e Claude Code no mesmo repositório.

#### Fontes
- [API](https://api.github.com/repos/Fission-AI/OpenSpec) · [releases](https://api.github.com/repos/Fission-AI/OpenSpec/releases) · [v1.0.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.0.0) · [v1.2.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.2.0) · [v1.6.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.6.0)
- [README](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/README.md)
- Docs: [supported-tools](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/supported-tools.md), [opsx](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md), [concepts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md), [explore](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/explore.md), [cli](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md), [existing-projects](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/existing-projects.md), [migration-guide](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/migration-guide.md), [getting-started](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/getting-started.md), [installation](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/installation.md), [agent-contract](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/agent-contract.md)
- Schema e templates: [schema.yaml](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/schema.yaml), [proposal](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/proposal.md), [spec](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/spec.md), [design](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/design.md), [tasks](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/tasks.md)
- Skills: [propose.ts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/propose.ts), [apply-change.ts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/apply-change.ts)
- [Thoughtworks Radar – OpenSpec](https://www.thoughtworks.com/en-us/radar/tools/openspec) · [YC – OpenSpec](https://www.ycombinator.com/companies/openspec) · [Tabish Bidiwale (GitHub)](https://github.com/TabishB)

---

### 4.3 Kiro (AWS) — specs + steering

#### Identidade e maturidade
- **Produto:** proprietário da AWS, lançado em 14/07/2025. Superfícies: **IDE** (baseada em Code OSS; IDE 1.1 em 14/09/2026), **CLI** (2.22.0 em 16/09/2026) e **Web** (GA em 01/09/2026).
- **Preços:** Free (50 créditos), Pro US$20, Pro+ US$40, Pro Max US$100, Power US$200 e Enterprise. Os créditos adicionais custam US$0,04.
- **Specs** ficam em `.kiro/specs/` e são compartilhadas entre as superfícies: dá para começar no CLI e continuar na IDE.

#### Agentes e pi
- **Só o próprio Kiro** executa o fluxo. pi e Claude Code **não** o executam nativamente.
- O formato (markdown em `.kiro/`) é portável: o **cc-sdd** (4.7) replica a estrutura para outros agentes.
- O Kiro reconhece `AGENTS.md`.

#### Workflow
- **Feature Spec:** escolha **Requirements-First** ou **Design-First**.
  1. Gerar `requirements.md`.
  2. **Revisar e aprovar.**
  3. Gerar `design.md`.
  4. **Aprovar.**
  5. Gerar `tasks.md`.
  6. Executar: tarefas individuais ou "todas". O Kiro monta um grafo de dependências e executa "waves" de tarefas independentes.
- **Quick Spec:** faz perguntas de clarificação no início (escopo, restrições, edge cases) e gera os 3 artefatos **sem gates**. Página atualizada em 04/08/2026.
- **Bugfix Spec:** `bugfix.md` com *Current Behavior (Defect)*, *Expected Behavior (Correct)* e *Unchanged Behavior (Regression Prevention)* → `design.md` (causa raiz) → `tasks.md` com property-based tests.
- **Analyze Requirements:**
  - raciocínio entre requisitos para achar inconsistências, ambiguidades, restrições conflitantes, suposições não ditas e edge cases faltantes;
  - faz **perguntas** no chat com correções sugeridas e atualiza o `requirements.md` conforme você responde;
  - leva "minutes, not seconds". Página atualizada em 02/09/2026.
- **Manutenção:** "Refine" no design e "Sync Files" no `tasks.md` (marca automaticamente as tarefas já feitas).

#### Estrutura de pastas
```text
.kiro/
├── steering/                 # memória do projeto (workspace)
│   ├── product.md            # propósito, usuários, objetivos
│   ├── tech.md               # frameworks, libs, restrições
│   └── structure.md          # organização de arquivos e padrões
└── specs/
    └── salvar-nota-memoria/
        ├── requirements.md   # (ou bugfix.md)
        ├── design.md
        └── tasks.md
~/.kiro/steering/             # steering global (o workspace tem precedência)
```

#### Conteúdo dos artefatos
- **`requirements.md`:** `# Requirements Document`, `## Introduction`, `## Requirements`, `### Requirement N`, `**User Story:** As a …, I want …, so that …` e *Acceptance Criteria* numerados em **EARS**.
- **EARS** (Easy Approach to Requirements Syntax; Alistair Mavin et al., Rolls-Royce, RE'09) tem 5 padrões:
  - ubíquo: "THE SYSTEM SHALL …";
  - por evento: `WHEN … THE SYSTEM SHALL …`;
  - por estado: `WHILE …`;
  - comportamento indesejado: `IF … THEN …`;
  - feature opcional: `WHERE …`.
  - O Kiro documenta a forma `WHEN [condition/event] THE SYSTEM SHALL [expected behavior]`.
- **`design.md`:** arquitetura, diagramas de sequência, componentes e interfaces, modelos de dados, tratamento de erros e estratégia de testes. Para TypeScript, gera interfaces. Os títulos exatos das seções não foram verificados literalmente.
- **`tasks.md`:** `# Implementation Plan`, `- [ ] 1. <tarefa>` com sub-bullets de passos e rastreabilidade `_Requirements: 1.1, 1.5_`.
- **Steering (front-matter YAML):**
  - `inclusion: always` (padrão);
  - `inclusion: fileMatch` com `fileMatchPattern: "components/**/*.tsx"` (aceita lista);
  - `inclusion: manual` (via `#nome-do-arquivo` no chat);
  - `inclusion: auto` com `name` e `description`;
  - referência a arquivos: `#[[file:caminho]]`.

#### Exemplo ilustrativo
```markdown
<!-- .kiro/specs/salvar-nota-memoria/requirements.md -->
# Requirements Document
## Introduction
Comando para salvar notas curtas de memória que persistem entre sessões.
## Requirements
### Requirement 1
**User Story:** Como dev, quero salvar uma nota com `/lembrar`, para que o agente a recupere em sessões futuras.
#### Acceptance Criteria
1. WHEN o usuário executa `/lembrar <texto>` com 1–500 caracteres THE SYSTEM SHALL persistir a nota com id e data de criação.
2. IF o texto estiver vazio THEN THE SYSTEM SHALL recusar a nota e exibir uma mensagem de erro.
3. WHILE o arquivo de notas estiver sem permissão de escrita THE SYSTEM SHALL preservar as notas existentes e reportar a falha.
```
```markdown
<!-- .kiro/specs/salvar-nota-memoria/tasks.md -->
# Implementation Plan
- [ ] 1. Criar modelo e validação de nota
  - Definir `MemoryNote` e `validateNote()`; testes de limites de tamanho
  - _Requirements: 1.1, 1.2_
- [ ] 2. Implementar persistência append-only e o comando `/lembrar`
  - _Requirements: 1.1, 1.3_
```

#### Perguntas antes do código
- Gates de aprovação entre as fases (exceto Quick Spec).
- *Analyze Requirements* (perguntas sobre conflitos e ambiguidades).
- Quick Spec faz perguntas antes de gerar.

#### Contexto entre sessões
- Steering carregado automaticamente conforme a inclusion.
- `#spec` inclui todos os arquivos da spec no contexto de um chat novo.
- Status das tarefas em tempo real no `tasks.md`.
- "Sync Files" para acompanhar o que foi feito fora do fluxo.
- As specs são pensadas para serem versionadas no git.

#### Pontos fortes
- EARS dá requisitos testáveis.
- Steering com inclusion condicional é um ótimo modelo de "memória de projeto".
- Bugfix spec com "Unchanged Behavior".
- Analyze Requirements.

#### Fraquezas e críticas
- **Lock-in:** `.kiro/`, Bedrock e créditos AWS ("the spec's value is realized inside Kiro and AWS").
- **Críticas de preço:** o modelo de créditos gerou reação negativa da comunidade.
- **Workflow desproporcional:** Böckeler viu um bug pequeno virar 4 user stories com 16 critérios de aceitação ("sledgehammer to crack a nut").

#### Fit
- **Baixo** para quem quer ficar no pi e no Claude Code.
- **Alto** como fonte de ideias (EARS + steering) ou via cc-sdd.

#### Fontes
- [Specs](https://kiro.dev/docs/specs/) · [Feature Specs](https://kiro.dev/docs/specs/feature-specs/) · [Requirements-First](https://kiro.dev/docs/specs/feature-specs/requirements-first/) · [Quick Spec](https://kiro.dev/docs/specs/quick-spec/) · [Bugfix Specs](https://kiro.dev/docs/specs/bugfix-specs/) · [Analyze Requirements](https://kiro.dev/docs/specs/analyze-requirements/) · [Best practices](https://kiro.dev/docs/specs/best-practices/)
- [Steering](https://kiro.dev/docs/steering/) · [Changelog](https://kiro.dev/changelog/) · [Pricing](https://kiro.dev/pricing/) · [Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)
- [promptz – formato das specs](https://www.promptz.dev/steering/promptz-steering-kiro-specs) · [codemyspec – Kiro specs (jun/2026; vendor)](https://codemyspec.com/blog/kiro-specs-explained)
- [EARS (Wikipedia)](https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.4 BMAD Method (`bmad-code-org/BMAD-METHOD`)

#### Identidade e maturidade
- **Mantenedor:** BMad Code, LLC.
- **Licença:** MIT, com aviso de trademark para "BMad", "BMad Method" e "BMad Core" (ver TRADEMARK.md). A API do GitHub mostra "Other" por causa disso.
- **Números:** ~53k stars.
- **Versões:**
  - **estável: v6.12.0** (release no GitHub em 04/09/2026; o changelog diz 03/09). A v6.0.0 estável saiu em 17/02/2026.
  - **v7 em preview** no `main`: o PR #2768, mesclado em 05/09/2026 e ainda sem release, distribui o BMAD como uma árvore plana de skills via `npx skills add` e marketplaces de plugins, e remove o instalador npm clássico.
  - O site de docs parece refletir o `main`, incluindo recursos de preview.
- **Requisitos:** Node ≥ 20.12, `uv` (para `bmad-build` e `bmad-build-auto`), Git.
- **Churn alto:**
  - v6.11 (10/08/2026) renomeou `bmad-quick-dev` → `bmad-build` e `bmad-dev-auto` → `bmad-build-auto`, reduziu as core skills de 14 para 8 e passou a config para TOML em camadas;
  - v6.12 fez o Build "decidir quanta cerimônia" após investigar, e `persistent_facts` passou a vir vazio.

#### Agentes e pi
- **Estável (v6.12.0):** 48 códigos de plataforma, entre eles `claude-code` (`.claude/skills`) e **`pi` (`.agents/skills`)**. O pi foi adicionado no PR #1854 em 08/03/2026.
- **v7 preview:** `npx skills add` (Vercel skills CLI, que suporta Pi) ou marketplaces de plugins de Claude Code e Codex.

#### Instalação
```bash
# estável (v6.x)
npx bmad-method install --directory . --modules bmm --tools claude-code --yes
npx bmad-method install --list-tools        # lista as ferramentas; para pi: --tools pi
# (sintaxe para várias ferramentas numa mesma flag: não verificado)

# v7 preview (main)
npx skills add bmad-code-org/BMAD-METHOD     # depois peça ao skill `bmad` para rodar "bmad setup"
# Claude Code: /plugin marketplace add bmad-code-org/bmad-plugins
```

#### Workflow
- **Loop:** Clarify → Plan → Build and verify → Learn and adjust.
- **4 "planning paths"** proporcionais ao tamanho:
  1. **Trivial:** sem BMAD.
  2. **One-session:** intenção → `bmad-build` → resultado.
  3. **Epic-sized:** `bmad-spec` → (preview v7: `bmad-preview-ticketing` → `tickets.toml`) → `bmad-build` por story → `bmad-retrospective`.
  4. **Project-sized:** PRD, UX e arquitetura compartilhados → vários ciclos de épico → integração.
- **Skills por fase:**
  - Analysis: `bmad-brainstorming`, `bmad-forge-idea`, `bmad-deep-recon`, `bmad-product-brief`, `bmad-prfaq`.
  - Planning: `bmad-prd`, `bmad-ux` (gera `DESIGN.md` + `EXPERIENCE.md`), `bmad-spec`.
  - Solutioning: `bmad-architecture`, `bmad-create-epics-and-stories`, `bmad-sprint-planning`, `bmad-correct-course`.
  - Implementation: `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-walkthrough`, `bmad-retrospective`, `bmad-qa-generate-e2e-tests`.
  - Core: `bmad-help` (responde e **recomenda a próxima skill**), `bmad-advanced-elicitation`, `bmad-review`, `bmad-customize`, `bmad-party-mode`.
- **Personas:** Mary (analyst), John (PM), Winston (architect), Amelia (dev), Sally (UX).

#### Estrutura de pastas (parcialmente verificada)
```text
_bmad/                                   # config compartilhada (TOML em camadas desde 6.11) + scripts
_bmad-output/
├── planning-artifacts/                  # brief, PRD (prds/prd-<nome>-<data>/), UX, arquitetura, épicos, specs/spec-<slug>/SPEC.md
└── implementation-artifacts/            # story files, sprint-status.yaml, my-intent.md (entrada do build)
.claude/skills/bmad-*/SKILL.md           # ou .agents/skills/ (pi, codex…)
deferred-work.md                         # itens adiados pela review (localização exata não verificada)
AGENTS.md                                # bloco <!-- bmad:context --> … <!-- /bmad:context --> (docs do main)
```

#### Conteúdo dos artefatos
- **`SPEC.md` (`bmad-spec`):**
  - cinco campos: *Why*, *Capabilities* (cada uma com intent e success condition; IDs `CAP-N` estáveis), *Constraints*, *Non-goals* e *Success signal*;
  - mais tabelas, diagramas e referências;
  - "Do not hand-edit it": para alterar, rode a skill de novo.
- **PRD:** capacidades por grupos de features, com IDs FR estáveis e NFRs separados. Tem modo *Create/Update/Validate*.
- **Story files:** incluem uma seção `## Plan` vazia, reservada para o agente de dev preencher.
- **`sprint-status.yaml`:** status das stories; "show/validate/fix sprint status".

#### Exemplo ilustrativo — `SPEC.md`
```markdown
# SPEC: Notas de memória
## Why
Decisões se perdem entre sessões do agente.
## Capabilities
- CAP-1 Salvar nota — intent: registrar texto curto; success: a nota aparece na sessão seguinte.
- CAP-2 Rejeitar nota inválida — intent: evitar lixo; success: vazio ou >500 caracteres é recusado sem gravar.
## Constraints
- Armazenamento local, por projeto; sem dependências novas.
## Non-goals
- Sincronização entre máquinas; busca semântica.
## Success signal
- Uma semana de uso sem decisões repetidas por esquecimento.
## Open questions
- Deduplicar notas idênticas?
```

#### Perguntas antes do código
- `bmad-forge-idea` testa ideias ainda cruas.
- `bmad-brainstorming` e `bmad-advanced-elicitation`.
- `bmad-prd` tem dois modos:
  - **fast path:** junta as lacunas em 1–2 perguntas e marca `[ASSUMPTION]`;
  - **coaching path:** seção por seção, contestando respostas fracas.
- `bmad-spec`: rascunho em que "every gap becomes an open question", ou um passeio guiado pelos 5 campos.
- **`bmad-build`:** investiga e escolhe o caminho mais leve seguro. Se houver lacunas de intenção, escreve um plano e **registra cada lacuna como open question a responder antes da aprovação**.
- `bmad-sprint-planning`: gate de prontidão ("can devs implement without inventing undocumented decisions?").

#### Contexto entre sessões
- Artefatos em `_bmad-output/`.
- `sprint-status.yaml` com "recommended next action": retomar o que está em progresso → revisar → começar stories prontas…
- `bmad-help` recomenda a próxima skill.
- Bloco de project context no `AGENTS.md`, gerado por `bmad-project-context`, que "never commits".
- A recomendação é abrir um chat novo para cada `bmad-build`.

#### Pontos fortes
- Cobertura ponta a ponta (produto → arquitetura → stories → review).
- Rastreabilidade.
- Suporte a pi.
- Versões novas escalam a cerimônia ao tamanho da tarefa.

#### Fraquezas e críticas
- **Custo de tokens:** issue #511 (ago/2025) cita arquivos lidos repetidamente; relatos de 2026 falam em limites de plano estourando.
- **Curva de aprendizado.**
- **"Multiplicador de processo":** reproduz o caos entre agentes quando o processo de base não existe (dev.to, abr/2026).
- **Churn** de nomes e distribuição (v6.11, v6.12, v7).

#### Fit
- Para um plugin TS pequeno, o fluxo completo é overkill.
- Dá para usar só `bmad-build` (one-session) ou `bmad-spec` + `bmad-build`.

#### Fontes
- [API](https://api.github.com/repos/bmad-code-org/BMAD-METHOD) · [releases](https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases) · [v6.0.0](https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases/tags/v6.0.0) · [v6.5.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0)
- [README](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/README.md) · [LICENSE](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/LICENSE) · [CHANGELOG](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/CHANGELOG.md)
- Docs: [home](https://docs.bmad-method.org/), [skills & agents](https://docs.bmad-method.org/reference/skills-and-agents/), [install](https://docs.bmad-method.org/start/install-bmad/), [first change](https://docs.bmad-method.org/start/build-your-first-change/), [planning paths](https://docs.bmad-method.org/plan/choose-a-planning-path/), [requirements/spec](https://docs.bmad-method.org/plan/define-requirements-and-a-specification/), [project context](https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/), [stories](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/), [build](https://docs.bmad-method.org/build/build-a-change/), [v7 previews](https://docs.bmad-method.org/plan/help-test-v7-previews/)
- [platform-codes.yaml @v6.12.0](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/v6.12.0/tools/installer/ide/platform-codes.yaml) · [PR #1854 (pi)](https://github.com/bmad-code-org/BMAD-METHOD/pull/1854) · [issue #1853](https://github.com/bmad-code-org/BMAD-METHOD/issues/1853) · [PR #2768 (v7)](https://github.com/bmad-code-org/BMAD-METHOD/pull/2768)
- [issue #511 (tokens)](https://github.com/bmad-code-org/BMAD-METHOD/issues/511) · [issue tracker de terceiros sobre paths do 6.12](https://github.com/pasqualtroncone/bmad-issue-tracking/issues/105) · [dev.to – Spec Kit vs BMAD vs OpenSpec (abr/2026)](https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j) · [Reenbit – custo de tokens](https://reenbit.com/bmad-method-token-budget-context-engineering-roi/)

---

### 4.5 Agent OS (`buildermethods/agent-os`)

#### Identidade e maturidade
- **Mantenedor:** Brian Casel (Builder Methods).
- **Licença:** MIT.
- **Números:** ~5,4k stars.
- **Versão:** **v3.0.0 (20/01/2026)**. Depois disso houve só correções de script (mai/2026) e um commit "orb setup and resume scripts" (29/08/2026). A atividade é baixa.
- **Instalação:** as instruções no site ficam atrás de cadastro por e-mail.

#### O que mudou na v3
- **Refoco em *standards*:** `/discover-standards` e `/inject-standards`, com `index.yml`.
- **Removidos:** fases de implementação e orquestração, delegação a subagentes, quebra em tasks e escrita de spec.
- A criação do plano passa ao **Plan Mode** do agente, "enriquecido" por `/shape-spec`.

#### Agentes e pi
- O script de projeto copia commands **só para `.claude/commands/agent-os/`**.
- As docs dizem que funciona com Cursor, Windsurf e Codex "since all outputs are markdown", mas isso exige referência manual.
- **pi: não suportado oficialmente.** Os commands dependem de plan mode e da ferramenta AskUserQuestion do Claude Code. No pi, você teria de adaptar (pacotes de plan mode existem).

#### Instalação (inferida dos scripts do repo; não verificado nas docs, que exigem e-mail)
```bash
# base install em ~/agent-os (o script espera essa localização)
~/agent-os/scripts/project-install.sh [--profile <nome>] [--commands-only] [--verbose]
```
- No Windows, o script bash precisa de Git Bash ou WSL.

#### Comandos
- `/plan-product`
- `/discover-standards`
- `/index-standards`
- `/inject-standards`
- `/shape-spec`

#### Estrutura de pastas
```text
agent-os/
├── product/
│   ├── mission.md        # Problem, Target Users, Solution
│   ├── roadmap.md        # Phase 1: MVP, Phase 2: Post-Launch
│   └── tech-stack.md     # Frontend, Backend, Database, Other
├── standards/
│   ├── index.yml
│   └── <pasta>/<standard>.md
└── specs/
    └── 2026-09-23-1430-salvar-nota-memoria/
        ├── plan.md        # plano completo (Task 1 = "Save spec documentation")
        ├── shape.md       # escopo, decisões, contexto da conversa
        ├── standards.md   # conteúdo integral dos standards aplicáveis
        ├── references.md  # ponteiros para código semelhante
        └── visuals/       # mockups/screenshots (opcional)
.claude/commands/agent-os/{discover-standards,index-standards,inject-standards,plan-product,shape-spec}.md
```

#### Exemplo ilustrativo — `shape.md` (resumido)
```markdown
# Shape: salvar nota de memória
## Escopo
Comando `/lembrar <texto>` que grava notas por projeto.
## Decisões
- JSONL append-only em `memory/notes.jsonl` (simples, diff-friendly)
- Limite de 500 caracteres
## Fora de escopo
- Sincronização; busca
## Standards aplicados
- typescript/error-handling, testing/vitest
```

#### Perguntas antes do código
- **`/shape-spec`:** só roda em plan mode. Usa AskUserQuestion **uma pergunta por vez**:
  1. o que estamos construindo, com 1–2 follow-ups;
  2. visuais;
  3. código de referência;
  4. alinhamento com o produto;
  5. confirmação dos standards;
  6. aprovação do plano.
- **`/plan-product`:** 7 perguntas sequenciais.
- **`/discover-standards`:** ciclo "ask → draft → confirm → create" para cada standard.

#### Contexto entre sessões
- Standards indexados e injetáveis.
- Docs de produto.
- Pasta de spec persistente.
- **Não há** rastreamento de tarefas/estado além do `plan.md`.

#### Pontos fortes
- Ótimo para capturar "tribal knowledge" (standards) de forma enxuta.

#### Fraquezas
- Não mantém mais specs duráveis nem tasks: um comparativo de jun/2026 diz "no longer maintains durable specs".
- Centrado em Claude Code.
- Pouca atividade.

#### Fit
- Complemento de *standards* para Claude Code.
- Fraco como toolkit de SDD completo, principalmente no pi.

#### Fontes
- [API](https://api.github.com/repos/buildermethods/agent-os) · [releases](https://api.github.com/repos/buildermethods/agent-os/releases) · [README](https://raw.githubusercontent.com/buildermethods/agent-os/main/README.md) · [CHANGELOG](https://raw.githubusercontent.com/buildermethods/agent-os/main/CHANGELOG.md) · [commits](https://github.com/buildermethods/agent-os/commits/main)
- [Site](https://buildermethods.com/agent-os) · [Workflow](https://buildermethods.com/agent-os/workflow) · [Installation (e-mail)](https://buildermethods.com/agent-os/installation)
- Commands: [shape-spec](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md), [plan-product](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/plan-product.md), [discover-standards](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/discover-standards.md), [inject-standards](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/inject-standards.md) · [project-install.sh](https://raw.githubusercontent.com/buildermethods/agent-os/main/scripts/project-install.sh)
- [codemyspec – comparativo 2026 (vendor)](https://codemyspec.com/blog/spec-driven-development)

---

### 4.6 Claude Task Master (`eyaltoledano/claude-task-master`, npm `task-master-ai`)

#### Identidade e maturidade
- **Mantenedor:** Eyal Toledano e equipe (Wheel Go Fast, Inc.).
- **Licença:** **MIT + Commons Clause** (proíbe vender o software ou serviços pagos baseados nele).
- **Números:** ~28k stars.
- **Versão:** última **v0.43.1 (31/03/2026)**. Os últimos commits são de abr/2026 e só mexem em docs: as URLs task-master.dev foram "aposentadas" e as docs foram para tryhamster.com.
- **Situação:** o foco da empresa migrou para o **Hamster** (plataforma de planejamento). A integração com o Hamster existe desde a v0.37.

#### Agentes e pi
- **Perfis de regras (`src/profiles`):** amp, claude, cline, codex, cursor, gemini, kilo, kiro, opencode, roo, trae, vscode, windsurf, zed. **Não há perfil de pi.**
- **Via CLI:** funciona com qualquer agente que tenha shell. No pi isso é o caminho natural, porque o pi não tem MCP nativo.
- **Via MCP:** `claude mcp add taskmaster-ai -- npx -y task-master-ai`.
- **Chave de API:** exige pelo menos uma, exceto se você usar os providers Claude Code ou Codex CLI.

#### Instalação e workflow
```bash
npm install -g task-master-ai
task-master init --rules claude          # cria .taskmaster/ + regras do editor
task-master models                       # configura modelos/providers
task-master parse-prd .taskmaster/docs/prd.txt
task-master analyze-complexity
task-master expand --all                 # (ou --id=5 [--research])
task-master next                         # próxima tarefa respeitando dependências
task-master show 5
task-master set-status --id=5 --status=done
task-master update-subtask --id=5.2 --prompt="notas do que foi feito"
task-master update --from=6 --prompt="mudança de abordagem"
task-master add-tag --from-branch        # tags isolam listas por branch/feature
task-master loop                         # v0.41+: Claude Code em sandbox Docker, 1 tarefa por iteração
```

#### Estrutura de pastas
```text
.taskmaster/
├── config.json                  # modelos/providers, parâmetros
├── state.json
├── docs/prd.txt                 # (ou .md) o PRD
├── tasks/tasks.json             # "banco" de tarefas (caminho: não verificado literalmente)
├── reports/                     # relatório de complexidade
├── templates/example_prd.txt    # (+ variante "RPG" para dependências complexas)
└── loop-progress.txt            # progresso do `loop`
```

#### Formato da tarefa (exemplo ilustrativo)
```json
{
  "id": 3,
  "title": "Persistir nota de memória",
  "description": "Gravar notas append-only no arquivo de notas do projeto",
  "status": "pending",
  "dependencies": [2],
  "priority": "high",
  "details": "Criar diretório se não existir; usar escrita append; tratar EACCES",
  "testStrategy": "Duas gravações consecutivas seguidas de leitura",
  "subtasks": []
}
```
- Campos documentados: id, title, description, status, dependencies, priority, details, testStrategy, subtasks, metadata.
- Status documentados: pending, done, deferred. Outros, como in-progress: não verificado.

#### Perguntas antes do código
- **Fraco.** Não há passo formal de clarificação: a qualidade depende do PRD, escrito em conjunto com o LLM a partir do template.
- `research` (com contexto do projeto e arquivos), `analyze-complexity` e `expand --research` ajudam, mas não fazem perguntas ao usuário.

#### Contexto entre sessões
- **Forte no "o que fazer agora":** `tasks.json` com dependências, `next`, tags por branch e logs com timestamp via `update-subtask`.
- **Fraco no "o que e por quê":** os requisitos ficam no PRD.

#### Críticas
- Overhead para projetos simples.
- Chave de API.
- JSON ruim de revisar em PR.
- Licença não-OSI.
- Desaceleração do projeto.

#### Fit
- **Baixo** para o seu objetivo, que é documentação e perguntas primeiro.
- Útil só como "gerenciador de fila de tarefas".

#### Fontes
- [API](https://api.github.com/repos/eyaltoledano/claude-task-master) · [releases](https://api.github.com/repos/eyaltoledano/claude-task-master/releases) · [v0.41.0 (loop)](https://github.com/eyaltoledano/claude-task-master/releases/tag/task-master-ai@0.41.0) · [commits](https://github.com/eyaltoledano/claude-task-master/commits/main)
- [LICENSE](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/LICENSE) · [README](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/README.md) · [profiles](https://github.com/eyaltoledano/claude-task-master/tree/main/src/profiles)
- [docs/tutorial.md](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/tutorial.md) · [docs/configuration.md](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/configuration.md)
- [docs índice](https://docs.task-master.dev/llms.txt) · [task structure](https://docs.task-master.dev/capabilities/task-structure.md) · [PRD](https://docs.task-master.dev/getting-started/quick-start/prd-quick.md) · [installation](https://docs.task-master.dev/getting-started/quick-start/installation.md) · [execute](https://docs.task-master.dev/getting-started/quick-start/execute-quick.md)
- [Hamster – Taskmaster docs](https://tryhamster.com/docs/taskmaster) · [Hamster changelog](https://tryhamster.com/latest/changes/taskmaster)

---

### 4.7 cc-sdd (`gotalab/cc-sdd`) — resumido

- **Identidade:** implementa o fluxo **estilo Kiro** para outros agentes. MIT, ~3,7k stars, **v3.0.2 (13/04/2026)**; a v3.0.0 (09/04/2026) tornou o modo Skills o principal. Há commits até set/2026. Suporta 14 idiomas, **incluindo português**.
- **Agentes:** Claude Code e Codex (estáveis); Cursor, Copilot, Windsurf, OpenCode, Gemini CLI e Antigravity (beta). **pi: não suportado.** Não verifiquei se algum alvo grava em `.agents/skills`, o que permitiria o pi ler as skills.
- **Instalação:** `npx cc-sdd@latest` (padrão Claude Skills), ou `--codex-skills`, `--cursor-skills` e similares, com `--lang <código>`. Os modos legados de "commands" estão deprecados.
- **Workflow:**
  1. `/kiro-discovery`: roteia o pedido (estender spec, implementar direto, spec nova ou decompor) e grava `brief.md`/`roadmap.md`.
  2. `/kiro-steering` (+ `/kiro-steering-custom`).
  3. `/kiro-spec-init`.
  4. `/kiro-spec-requirements` (EARS).
  5. `/kiro-validate-gap` (opcional).
  6. `/kiro-spec-design`: inclui um *File Structure Plan* e limites entre componentes.
  7. `/kiro-validate-design` (opcional).
  8. `/kiro-spec-tasks`: campos `_Requirements:_` e `_Boundary:_`.
  9. `/kiro-impl`: implementação autônoma com implementer, reviewer e debugger novos por tarefa, e TDD.
  10. `/kiro-validate-impl`: GO, NO-GO ou MANUAL_VERIFY_REQUIRED.
  - Também há `/kiro-spec-batch` (várias specs) e as skills `kiro-review`, `kiro-debug` e `kiro-verify-completion`.
- **Estrutura:**
```text
.kiro/
├── steering/{product,tech,structure}.md
├── specs/<feature>/{requirements.md, design.md, tasks.md, spec.json, research.md}
└── settings/templates/        # templates customizáveis (com checklists embutidos)
```
- **Perguntas e contexto:**
  - cada fase pausa para revisão humana, e o `spec.json` guarda fase e aprovações (campos exatos não verificados);
  - `brief.md` persiste o escopo entre sessões;
  - o steering funciona como memória do projeto.
- **Fit:** bom para quem quer "Kiro no Claude Code". Sem pi; comunidade pequena.
- **Fontes:** [API](https://api.github.com/repos/gotalab/cc-sdd) · [releases](https://api.github.com/repos/gotalab/cc-sdd/releases) · [v3.0.0](https://github.com/gotalab/cc-sdd/releases/tag/v3.0.0) · [README](https://raw.githubusercontent.com/gotalab/cc-sdd/main/README.md) · [skill-reference](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/skill-reference.md) · [spec-driven guide](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/spec-driven.md) · [migration-guide](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/migration-guide.md)

---

### 4.8 Tessl — resumido

- **Empresa:** fundada por Guy Podjarny (ex-Snyk), com ~US$125M captados.
- **Produtos:**
  - **Registry** em GA: "Spec Registry" lançado em set/2025 e renomeado "Skills Registry" em jan/2026;
  - **Tessl Framework** (a visão *spec-as-source*, com regeneração de código a partir da spec) segue em **beta fechado**, só JavaScript e não determinístico, segundo review de jun/2026 publicado por um vendor concorrente.
- **Tile `tessl-labs/spec-driven-development` (v2.0.1, MIT, repo `tesslio/spec-driven-development-tile`):**
  - skills: `requirement-gathering`, `spec-writer`, `spec-verification`, `work-review`;
  - regras: `spec-before-code` ("Never begin implementation without an approved spec"), `one-question-at-a-time` e a opcional `spec-format-compliance`;
  - specs `.spec.md` com front-matter YAML (`name`, `description`, `targets` com globs) e links `[@test]` para os testes que verificam cada requisito;
  - os arquivos vão para `.tessl/`;
  - instalação: `npx @tessl/cli install tessl-labs/spec-driven-development` (ou `tessl init` + `tessl install …`).
- **Agentes:** "MCP-compatible agent (Claude Code, Cursor, etc.)". **pi: não verificado**, e o pi não tem MCP nativo.
- **Fit:** as ideias `[@test]` (rastreabilidade de requisito para teste) e "uma pergunta por mensagem" são reaproveitáveis. A plataforma em si é imatura para adoção.
- **Fontes:** [Registry tile](https://tessl.io/registry/tessl-labs/spec-driven-development) · [repo do tile](https://github.com/tesslio/spec-driven-development-tile) · [README do tile](https://raw.githubusercontent.com/tesslio/spec-driven-development-tile/main/README.md) · [codemyspec – Tessl review (jun/2026; vendor)](https://codemyspec.com/blog/tessl-review) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.9 Outros proeminentes em 2026 (não estavam na lista)

#### 4.9.1 Superpowers (`obra/superpowers`) — muito relevante para o seu caso
- **Identidade:** metodologia + biblioteca de skills de Jesse Vincent. MIT, **~290k stars**, **v6.4.1 (19/09/2026)**.
- **Agentes:** Claude Code (plugin marketplace), Codex, Cursor, Gemini CLI, OpenCode, Antigravity, Devin, Droid, Copilot e outros.
  - **pi:** `pi install git:github.com/obra/superpowers`.
  - O README diz que o pi tem skills nativas, e que "subagent and task-list tools remain optional Pi companion packages".
  - A v6.4 criou um modo *native inline* de execução, mais barato que subagentes, o que é bom para o pi.
- **Workflow:**
  1. `brainstorming`
  2. `using-git-worktrees`
  3. `writing-plans`
  4. `subagent-driven-development` ou `executing-plans`
  5. `test-driven-development`
  6. `requesting-code-review`
  7. `finishing-a-development-branch`
- **Perguntas antes do código (verificado literalmente):**
  - *hard gate*: nada de código, scaffolding ou dependências antes de concluir os pré-requisitos do caminho escolhido;
  - "Only one question per message"; "Prefer multiple choice questions";
  - propõe 2–3 abordagens com trade-offs e uma recomendação;
  - design em seções com aprovação a cada uma ("Present, then stop until you hear yes");
  - três caminhos (spike, bounded, architectural). Na dúvida, escolhe o mais pesado.
- **Artefatos:**
  - spec em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, com self-review e review do usuário;
  - plano em `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. O cabeçalho tem goal, arquitetura, stack, caminho da spec e restrições. As tarefas de 2–5 min trazem arquivos exatos, código, comandos com saída esperada e commit, e é proibido deixar placeholders ("TBD").
- **Contexto entre sessões:**
  - ledger `.superpowers/sdd/<plano>/progress.md`: "Tasks with a `Task <N>: complete` line are DONE — do not redo them";
  - plano e spec versionados;
  - hooks de SessionStart carregam o bootstrap das skills.
- **Críticas:** o "mega-orquestrador" pode estourar contexto em sessões longas; o modo com subagentes custa tokens (Pulumi, abr/ago 2026).
- **Exemplo ilustrativo (trecho de plano):**
```markdown
### Task 2: Persistência append-only
**Files:** Create `src/memory/store.ts`; Test `tests/memory/store.test.ts`
- [ ] Escrever teste que grava duas notas e lê as duas
- [ ] Rodar `npx vitest run tests/memory/store.test.ts` → Expected: FAIL (appendNote não existe)
- [ ] Implementar `appendNote()` com `fs.appendFile`
- [ ] Rodar o teste → Expected: PASS
- [ ] Commit: `feat(memory): append-only note store`
```
- **Fontes:** [API](https://api.github.com/repos/obra/superpowers) · [releases](https://api.github.com/repos/obra/superpowers/releases) · [v6.2.0](https://github.com/obra/superpowers/releases/tag/v6.2.0) · [README](https://raw.githubusercontent.com/obra/superpowers/main/README.md) · [repo](https://github.com/obra/superpowers) · [brainstorming](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md) · [writing-plans](https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md) · [executing-plans](https://raw.githubusercontent.com/obra/superpowers/main/skills/executing-plans/SKILL.md) · [Pulumi – Superpowers, GSD, gstack](https://www.pulumi.com/blog/claude-code-orchestration-frameworks/)

#### 4.9.2 GSD — "Get Shit Done" → **GSD Core** (`open-gsd/gsd-core`)
- **Histórico:** o repositório original `gsd-build/get-shit-done` (~64k stars) foi **arquivado em 26/06/2026**. O desenvolvimento continua como **GSD Core**: MIT, ~9,8k stars, **v1.14.0 (14/09/2026)**, instalado com `npx @opengsd/gsd-core@latest`.
- **Runtimes:** Claude Code, OpenCode, Kilo, Codex, Kimi, Copilot, Cursor, Windsurf, Cline, Qwen, Augment, Antigravity, Trae, ZCode e **pi** (`--pi`, instala uma extensão em `~/.pi/agent/…`).
  - O suporte a pi está documentado no branch `next`; o `main` tem `pi/gsd.cjs`, mas o README do `main` não lista pi. Suporte em release estável: não verificado.
- **Loop por fase:** `/gsd-new-project` (perguntas → pesquisa → requisitos → roadmap) → `/gsd-discuss-phase N` ("lock in your preferences") → `/gsd-plan-phase N` → `/gsd-execute-phase N` (ondas paralelas, cada executor com contexto novo) → `/gsd-verify-work N` (UAT manual) → `/gsd-ship N`.
  - Utilitários: `/gsd-progress`, `/gsd-pause-work`, `/gsd-resume-work` ("Full context restoration from last session"), `/gsd-quick`, `/gsd-onboard` (brownfield).
- **Estrutura:**
```text
.planning/
├── PROJECT.md  REQUIREMENTS.md  ROADMAP.md  STATE.md  config.json  MILESTONES.md  HANDOFF.json
├── research/  reports/  todos/  debug/  spikes/  sketches/  codebase/  onboarding/
└── phases/XX-nome/{XX-YY-PLAN.md, XX-YY-SUMMARY.md, CONTEXT.md, RESEARCH.md, VERIFICATION.md}
```
- **Fit:** é o mais forte em "não se perder" (estado em disco + handoff). Por outro lado é pesado ("ceremony overhead for quick scripts") e passou por turbulência de repositório.
- **Fontes:** [API original (archived)](https://api.github.com/repos/glittercowboy/get-shit-done) · [repo gsd-core](https://github.com/open-gsd/gsd-core) · [releases](https://api.github.com/repos/open-gsd/gsd-core/releases) · [USER-GUIDE](https://raw.githubusercontent.com/open-gsd/gsd-core/main/docs/USER-GUIDE.md) · [runtimes (next)](https://raw.githubusercontent.com/open-gsd/gsd-core/next/docs/how-to/install-on-your-runtime.md) · [pasta pi](https://github.com/open-gsd/gsd-core/tree/main/pi) · [Pulumi](https://www.pulumi.com/blog/claude-code-orchestration-frameworks/)

#### 4.9.3 Menções rápidas
- **gstack (`garrytan/gstack`):**
  - MIT, ~134k stars, criado em mar/2026;
  - 23 "papéis" (CEO, eng manager, QA…) para Claude Code, Codex, OpenCode, Cursor, Droid, Kiro e outros; **pi não mencionado**;
  - skills de planejamento (`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/autoplan`) leem e escrevem um `DESIGN.md` compartilhado;
  - é mais "revisão por papéis" que SDD.
  - Fontes: [API](https://api.github.com/repos/garrytan/gstack) · [README](https://raw.githubusercontent.com/garrytan/gstack/main/README.md).
- **Conductor (Google, `gemini-cli-extensions/conductor`):**
  - Apache-2.0, ~3,7k stars; para Antigravity e Claude Code;
  - estrutura: `conductor/{product.md, product-guidelines.md, tech-stack.md, workflow.md, tracks.md, code_styleguides/}` e `conductor/tracks/<id>/{spec.md, plan.md, metadata.json}`;
  - comandos: `/conductor:conductor-setup`, `…-new-track`, `…-implement`, `…-status`, `…-revert`, `…-review`.
  - Fontes: [API](https://api.github.com/repos/gemini-cli-extensions/conductor) · [README](https://raw.githubusercontent.com/gemini-cli-extensions/conductor/main/README.md).
- **pi-sdd-kit (`felipefontoura/pi-sdd-kit`):**
  - **nativo do pi** (`pi install npm:@felipefontoura/pi-sdd-kit`), com 10 skills `/skill:sdd-*`;
  - pipeline IDEA → PLAN → PRD → SPEC → TASKS → EXEC → REVIEW, com gates;
  - EARS, steering em `.ai/steering/`, specs em `.ai/sdd/specs/` e um arquivo `.status` como fonte da verdade das aprovações;
  - **muito imaturo:** ~29 stars, 10 commits, sem releases. Serve mais como referência de design.
  - Fonte: [repo](https://github.com/felipefontoura/pi-sdd-kit).
- **spec-kitty:** derivado do estilo Spec Kit, com kanban e worktrees. MIT, ~1,6k stars. Fonte: [API](https://api.github.com/repos/Priivacy-ai/spec-kitty).
- **Intent (Augment):** comercial, "living specs". Só citado no [landscape do specdriven.com](https://specdriven.com/landscape); não verificado.
- **Adjacente (não é SDD): Beads (`gastownhall/beads`, ex-`steveyegge/beads`):** "memory upgrade for your coding agent" (issue tracker para agentes). MIT, ~27k stars, ativo. Não aprofundado. Fonte: [API](https://api.github.com/repos/steveyegge/beads).

---

## 5. Críticas transversais ao SDD (2025–2026)

1. **Tamanho errado do processo.** Workflows fixos não servem para problemas de tamanhos diferentes: um bug pequeno virou 4 stories e 16 critérios no Kiro. **Revisar markdown pode custar mais que revisar código.** Os templates dão uma **falsa sensação de controle**, porque o agente ainda ignora instruções. Há paralelos com o fracasso do Model-Driven Development. Fonte: [Böckeler, 15/10/2025](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).
2. **Medição concreta.** Com Spec Kit (Copilot + Sonnet 4.5), foram 2.577 linhas de markdown, 33min30 de agente e 3,5 h de revisão, contra 8 min de agente e 24 min de revisão no modo iterativo. Veredito: "not a viable process, at least not in its purest form". Fonte: [Scott Logic, 26/11/2025](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html).
3. **Thoughtworks Technology Radar.** A técnica "Spec-driven development" está em **Assess**, com críticas a workflows "elaborate and opinionated" e "lengthy spec files that are hard to review", e a ressalva de que pode ser a "bitter lesson" de regras feitas à mão que não escalam. O OpenSpec entrou em **Assess** em abr/2026, avaliado positivamente como leve e agnóstico. Fontes: [SDD](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development) · [OpenSpec](https://www.thoughtworks.com/en-us/radar/tools/openspec).
4. **Spec drift sem solução automática.** Nenhum framework reconcilia spec e código sozinho. Recomenda-se reservar cerca de 30 min por mudança para reconciliar. Constitutions com regras de uma linha falham; é melhor escrever "não faça X porque Y; em vez disso Z". Fonte: [dev.to, 23/04/2026](https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j).
5. **Custo de tokens e coordenação** em pipelines multiagente (BMAD). Fontes: [issue #511](https://github.com/bmad-code-org/BMAD-METHOD/issues/511) · [Reenbit](https://reenbit.com/bmad-method-token-budget-context-engineering-roi/).
6. **Resposta do mercado em 2026: escalar a cerimônia.** Exemplos: "Build decides how much ceremony" (BMAD 6.12), "scales brainstorming ceremony to task size" (Superpowers 6.3), Quick Spec (Kiro), shorter path (Spec Kit) e perfil `core` (OpenSpec).

---

## 6. Recomendações para o seu cenário (solo, plugin TS pequeno, pi + Claude Code)

> O que segue é opinião do pesquisador, baseada nos fatos acima.

### Opção 1 (principal): **OpenSpec**, perfil `core`
- **Por quê:**
  - suporte oficial e simultâneo a pi e Claude Code com um único comando (`openspec init --tools claude,pi`);
  - leve;
  - brownfield-first;
  - specs acumulam (spec-anchored) e há histórico em `archive/`;
  - o CLI em JSON facilita retomar sessões (`openspec status`);
  - Node, sem Python.
- **Lacuna a cobrir:** a "clarificação obrigatória". Mitigue com:
  1. hábito: sempre `/opsx:explore` → `/opsx:propose`;
  2. `rules` no `config.yaml`;
  3. uma linha no `AGENTS.md` e no `CLAUDE.md`.
- **Exemplo ilustrativo de `config.yaml`:**
```yaml
schema: spec-driven
context: |
  Extensão TypeScript (ESM, Node 22) para pi e Claude Code. Testes com vitest.
  Estrutura: src/ (código), tests/ (testes). Sem dependências novas sem justificativa.
rules:
  proposal:
    - Liste explicitamente "Perguntas em aberto"; não gere design/tasks enquanto houver perguntas sem resposta.
  specs:
    - Todo requisito usa SHALL/MUST e tem pelo menos um cenário WHEN/THEN.
  tasks:
    - Cada tarefa informa o comando de verificação (ex.: npx vitest run <arquivo>).
```

### Opção 2 (gates formais): **Spec Kit** (`--integration claude` + `specify integration install pi`)
- **Escolha se** você quer que o próprio toolkit imponha:
  - `[NEEDS CLARIFICATION]`;
  - clarify (até 5 perguntas, registradas na spec);
  - checklist que bloqueia o implement;
  - analyze;
  - converge.
- **Custos:** mais markdown, Python/`uv` e churn alto de versões.
- **Dica:** use o full path só em features não triviais.

### Complemento de disciplina: **Superpowers**
- O brainstorming (hard gate, uma pergunta por mensagem, aprovação por seção) é o melhor mecanismo de "perguntar antes" do mercado, e roda no pi.
- **Cuidado:** instalar dois toolkits ativos no mesmo repositório pode gerar instruções conflitantes, por exemplo duas pastas de spec e dois fluxos de tarefas. Se combinar, defina no `AGENTS.md` qual é a fonte da verdade.

### Evitar neste cenário
- **BMAD:** pesado e com churn; no máximo `bmad-build` isolado.
- **Kiro:** lock-in e não roda no pi nem no Claude Code.
- **Agent OS:** só Claude Code e sem pipeline de spec/tasks.
- **Task Master:** sem pi, Commons Clause, desacelerado.
- **cc-sdd:** sem pi.
- **GSD Core:** pesado e com turbulência de repositório.
- **Tessl:** MCP e beta.

---

## 7. Mecanismos reaproveitáveis, caso você monte um fluxo próprio (AGENTS.md + prompt templates)

| Mecanismo | De onde vem | Por que vale |
|---|---|---|
| `[NEEDS CLARIFICATION: …]` com limite (ex.: 3) + "informed guesses" em `Assumptions` | Spec Kit | Evita tanto perguntas demais quanto suposições silenciosas |
| Sessão de clarify: no máximo 5 perguntas, **uma por vez**, com opção recomendada, respostas gravadas em `## Clarifications` → `### Session <data>` | Spec Kit | As respostas sobrevivem ao fim da sessão |
| Gate "checklist incompleto → pare e pergunte" antes de implementar | Spec Kit | Transforma "nada de código antes" em regra verificável |
| Delta specs (ADDED/MODIFIED/REMOVED) + `archive/AAAA-MM-DD-*` | OpenSpec | Histórico de decisões e specs vivas sem reescrever tudo |
| `context` injetado + `rules` por artefato | OpenSpec | Memória do projeto sempre presente |
| EARS (`WHEN/IF/WHILE … SHALL …`) | Kiro/cc-sdd | Critérios testáveis e sem ambiguidade |
| Steering com inclusion condicional (`fileMatch`) | Kiro | Contexto certo sem inflar o prompt |
| `Unchanged Behavior` em bugfix | Kiro | Previne regressões |
| Hard gate + "uma pergunta por mensagem" + aprovação por seção | Superpowers / Tessl | Disciplina de elicitação |
| Ledger de progresso ("Task N: complete") | Superpowers | Retomada após compactação |
| `STATE.md` + `HANDOFF.json` + comando de resume | GSD Core | "Onde parei" explícito |
| `[@test]` ligando requisito a teste | Tessl | Rastreabilidade requisito → verificação |
| `converge` (código × artefatos, acrescenta tarefas faltantes) | Spec Kit | Combate *drift* no fim da feature |

---

## 8. Itens não verificados (ou só parcialmente verificados)

- **Spec Kit:**
  - não há instrução explícita de "pular tarefas `[X]`" ao retomar o `/speckit-implement`; o estado fica implícito;
  - o conteúdo exato de `.specify/templates/` no projeto não foi confirmado;
  - a ausência de atualização automática de AGENTS.md/CLAUDE.md é inferida da pasta `scripts/bash` e de `base.py`.
- **Kiro:**
  - títulos exatos das seções do `design.md` (as docs descrevem os tópicos);
  - pastas `.kiro/` além de `steering/` e `specs/`;
  - a data e o volume exatos do blip "Spec-driven development" no Radar (a página indica ring Assess).
- **BMAD:**
  - conteúdo exato de `_bmad/`;
  - o caminho `planning-artifacts/` na 6.12 (confirmado só por um issue tracker de terceiros);
  - sintaxe para várias ferramentas em `--tools`;
  - localização do `deferred-work.md`;
  - se o caminho v7 (`npx skills add`) está pronto para pi.
- **Agent OS:** as instruções oficiais de instalação exigem e-mail; o fluxo foi inferido do `project-install.sh`.
- **Task Master:**
  - caminho literal de `.taskmaster/tasks/tasks.json`;
  - status além de pending, done e deferred.
- **cc-sdd:** diretórios-alvo das skills por agente; campos do `spec.json`; código de idioma para pt.
- **Tessl:** compatibilidade com pi.
- **GSD Core:** suporte a pi em release estável (documentado no branch `next`).
- **Superpowers no pi:** fluxos com subagentes e task-list exigem pacotes complementares; o comportamento exato não foi testado.
- **Números de stars:** lidos via API em 23/09/2026 por um extrator automático; trate-os como aproximados.

---

## 9. Fontes consolidadas

**Spec Kit:**
- https://api.github.com/repos/github/spec-kit
- https://api.github.com/repos/github/spec-kit/releases
- https://raw.githubusercontent.com/github/spec-kit/main/README.md
- https://github.github.io/spec-kit/
- https://github.github.io/spec-kit/quickstart.html
- https://github.github.io/spec-kit/reference/integrations.html
- https://github.github.io/spec-kit/reference/overview.html
- https://github.github.io/spec-kit/guides/existing-projects.html
- https://raw.githubusercontent.com/github/spec-kit/main/docs/upgrade.md
- https://raw.githubusercontent.com/github/spec-kit/main/docs/history.md
- https://github.com/github/spec-kit/tree/main/templates
- https://github.com/github/spec-kit/tree/main/templates/commands
- https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/constitution-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/plan.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/checklist.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/implement.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/converge.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/constitution.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/taskstoissues.md
- https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/pi/__init__.py
- https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/base.py
- https://raw.githubusercontent.com/github/spec-kit/main/integrations/catalog.json
- https://github.com/github/spec-kit/tree/main/scripts/bash

**OpenSpec:**
- https://api.github.com/repos/Fission-AI/OpenSpec
- https://api.github.com/repos/Fission-AI/OpenSpec/releases
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.0.0
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.2.0
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.6.0
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/README.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/supported-tools.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/explore.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/existing-projects.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/migration-guide.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/getting-started.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/installation.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/agent-contract.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/schema.yaml
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/proposal.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/spec.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/design.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/tasks.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/propose.ts
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/apply-change.ts
- https://www.thoughtworks.com/en-us/radar/tools/openspec
- https://www.ycombinator.com/companies/openspec
- https://github.com/TabishB

**Kiro:**
- https://kiro.dev/docs/specs/
- https://kiro.dev/docs/specs/feature-specs/
- https://kiro.dev/docs/specs/feature-specs/requirements-first/
- https://kiro.dev/docs/specs/quick-spec/
- https://kiro.dev/docs/specs/bugfix-specs/
- https://kiro.dev/docs/specs/analyze-requirements/
- https://kiro.dev/docs/specs/best-practices/
- https://kiro.dev/docs/steering/
- https://kiro.dev/changelog/
- https://kiro.dev/pricing/
- https://kiro.dev/blog/introducing-kiro/
- https://www.promptz.dev/steering/promptz-steering-kiro-specs
- https://codemyspec.com/blog/kiro-specs-explained
- https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax

**BMAD:**
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases/tags/v6.0.0
- https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/README.md
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/LICENSE
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/CHANGELOG.md
- https://docs.bmad-method.org/
- https://docs.bmad-method.org/reference/skills-and-agents/
- https://docs.bmad-method.org/start/install-bmad/
- https://docs.bmad-method.org/start/build-your-first-change/
- https://docs.bmad-method.org/plan/choose-a-planning-path/
- https://docs.bmad-method.org/plan/define-requirements-and-a-specification/
- https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/
- https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/
- https://docs.bmad-method.org/build/build-a-change/
- https://docs.bmad-method.org/plan/help-test-v7-previews/
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/v6.12.0/tools/installer/ide/platform-codes.yaml
- https://github.com/bmad-code-org/BMAD-METHOD/pull/1854
- https://github.com/bmad-code-org/BMAD-METHOD/issues/1853
- https://github.com/bmad-code-org/BMAD-METHOD/issues/2299
- https://github.com/bmad-code-org/BMAD-METHOD/pull/2768
- https://github.com/bmad-code-org/BMAD-METHOD/issues/511
- https://github.com/pasqualtroncone/bmad-issue-tracking/issues/105
- https://reenbit.com/bmad-method-token-budget-context-engineering-roi/

**Agent OS:**
- https://api.github.com/repos/buildermethods/agent-os
- https://api.github.com/repos/buildermethods/agent-os/releases
- https://raw.githubusercontent.com/buildermethods/agent-os/main/README.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/CHANGELOG.md
- https://github.com/buildermethods/agent-os/commits/main
- https://buildermethods.com/agent-os
- https://buildermethods.com/agent-os/workflow
- https://buildermethods.com/agent-os/installation
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/plan-product.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/discover-standards.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/inject-standards.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/scripts/project-install.sh

**Task Master:**
- https://api.github.com/repos/eyaltoledano/claude-task-master
- https://api.github.com/repos/eyaltoledano/claude-task-master/releases
- https://github.com/eyaltoledano/claude-task-master/releases/tag/task-master-ai@0.41.0
- https://github.com/eyaltoledano/claude-task-master/commits/main
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/LICENSE
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/README.md
- https://github.com/eyaltoledano/claude-task-master/tree/main/src/profiles
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/tutorial.md
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/configuration.md
- https://docs.task-master.dev/llms.txt
- https://docs.task-master.dev/capabilities/task-structure.md
- https://docs.task-master.dev/getting-started/quick-start/prd-quick.md
- https://docs.task-master.dev/getting-started/quick-start/installation.md
- https://docs.task-master.dev/getting-started/quick-start/execute-quick.md
- https://tryhamster.com/docs/taskmaster
- https://tryhamster.com/latest/changes/taskmaster

**cc-sdd:**
- https://api.github.com/repos/gotalab/cc-sdd
- https://api.github.com/repos/gotalab/cc-sdd/releases
- https://github.com/gotalab/cc-sdd/releases/tag/v3.0.0
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/README.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/skill-reference.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/spec-driven.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/migration-guide.md

**Tessl:**
- https://tessl.io/registry/tessl-labs/spec-driven-development
- https://github.com/tesslio/spec-driven-development-tile
- https://raw.githubusercontent.com/tesslio/spec-driven-development-tile/main/README.md
- https://codemyspec.com/blog/tessl-review

**Superpowers, GSD e outros:**
- https://api.github.com/repos/obra/superpowers
- https://api.github.com/repos/obra/superpowers/releases
- https://github.com/obra/superpowers/releases/tag/v6.2.0
- https://raw.githubusercontent.com/obra/superpowers/main/README.md
- https://github.com/obra/superpowers
- https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md
- https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md
- https://raw.githubusercontent.com/obra/superpowers/main/skills/executing-plans/SKILL.md
- https://api.github.com/repos/glittercowboy/get-shit-done
- https://github.com/open-gsd/gsd-core
- https://api.github.com/repos/open-gsd/gsd-core/releases
- https://raw.githubusercontent.com/open-gsd/gsd-core/main/docs/USER-GUIDE.md
- https://raw.githubusercontent.com/open-gsd/gsd-core/next/docs/how-to/install-on-your-runtime.md
- https://github.com/open-gsd/gsd-core/tree/main/pi
- https://api.github.com/repos/garrytan/gstack
- https://raw.githubusercontent.com/garrytan/gstack/main/README.md
- https://api.github.com/repos/gemini-cli-extensions/conductor
- https://raw.githubusercontent.com/gemini-cli-extensions/conductor/main/README.md
- https://github.com/felipefontoura/pi-sdd-kit
- https://api.github.com/repos/Priivacy-ai/spec-kitty
- https://api.github.com/repos/steveyegge/beads
- https://specdriven.com/landscape
- https://www.pulumi.com/blog/claude-code-orchestration-frameworks/

**pi:**
- https://pi.dev/
- https://pi.dev/docs/latest/skills
- https://pi.dev/docs/latest/prompt-templates
- https://pi.dev/docs/latest/settings
- https://pi.dev/packages
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md
- https://github.com/vercel-labs/skills (via resultados de busca: Vercel skills CLI suporta Pi)

**Críticas e comparativos:**
- https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html
- https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development
- https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j
- https://codemyspec.com/blog/openspec-vs-spec-kit (vendor)
- https://codemyspec.com/blog/spec-driven-development (vendor)
