# 05 — Proposta: o que vamos reaproveitar

> **Rascunho para discussão.** Nada aqui está decidido. Cada escolha tem um ID de pergunta em [06-perguntas-abertas.md](06-perguntas-abertas.md), e o ★ marca a recomendação.
> A proposta tem duas partes:
> - **(1) metodologia**, que vale para todos os seus projetos;
> - **(2) o projeto de memória** em si.

---

## Parte 1 — Metodologia: como vamos documentar para a LLM não se perder

### 1.1 Trilhas possíveis (decisão **Q-M1**)

| Trilha | O que é | Quando escolher |
|---|---|---|
| **A ★ OpenSpec + camada de projeto + gate de perguntas nosso** | OpenSpec cuida das specs e mudanças (roda no pi e no Claude Code). `docs/` guarda visão, requisitos, ADRs, STATE e perguntas. Um prompt `/entrevista` e uma regra no `AGENTS.md` fazem o gate de "perguntar antes" | Você quer reaproveitar uma ferramenta madura e leve, com artefatos curtos, que é o que a evidência favorece |
| **B Spec Kit + camada de projeto** | Spec Kit faz o gate sozinho: `clarify` com até 5 perguntas gravadas na spec, checklists que bloqueiam o `implement`, `analyze` e `converge`. A `constitution.md` guarda suas regras | Você quer que **a própria ferramenta** imponha "perguntar e checar antes" e aceita mais markdown para revisar |
| **C Superpowers** | Disciplina ponta a ponta: brainstorming com hard gate → plano com TDD → execução com ledger | Você prefere um fluxo opinativo e pronto, focado em execução com TDD |
| **D Kit 100% nosso** | Só `docs/` + 4 prompts (`/entrevista`, `/spec`, `/plano`, `/implementar`), no estilo Harper Reed + GSD | Zero dependência, controle total; você mantém tudo |

**Por que ★A:**
1. Suporte oficial ao pi e ao Claude Code com um único `openspec init --tools claude,pi`.
2. Roda em Node, sem Python.
3. Tem specs **vivas**: o comportamento do sistema acumula em `openspec/specs/`, o que serve bem a um sistema de longa duração como o de memória.
4. O Thoughtworks o avaliou bem por ser leve.

A lacuna dele, a falta de trava de perguntas, custa umas 30 linhas nossas, que pegam emprestado o formato de *clarifications* do Spec Kit e o hard gate do Superpowers.
**Não instale dois toolkits de SDD ao mesmo tempo**: eles criam duas fontes da verdade.

### 1.2 Camada global (todos os seus projetos)

```markdown
<!-- ~/.pi/agent/AGENTS.md  — e, no Claude Code, ~/.claude/CLAUDE.md contendo: @~/.pi/agent/AGENTS.md (import não testado) -->
# Regras pessoais (todos os projetos)
- Projeto novo ou feature não trivial: pesquisar → entrevistar → documentar → aprovar ANTES de qualquer código.
- Toda funcionalidade é configurável (chave, default, validação) e aparece num onboarding de configuração.
- Perguntas: uma por vez, com opções e a sua recomendação. Registre respostas em docs/OPEN-QUESTIONS.md.
- Idioma: pt-BR. Explique com código (árvores, trechos, comandos).
```

### 1.3 Estrutura de cada projeto (trilha A)

```text
<projeto>/
├── AGENTS.md                      # ≤ 60 linhas: regras + comandos (pi e Claude Code leem nativamente)
├── CLAUDE.md                      # opcional: "@AGENTS.md" + extras só do Claude Code
├── docs/
│   ├── STATE.md                   # < 100 linhas: fase, change ativa, próxima ação, bloqueios
│   ├── OPEN-QUESTIONS.md          # Q-xx; 🔴 aberta bloqueia aprovação
│   ├── 00-visao.md                # problema, objetivo, usuários, FORA de escopo, métricas de sucesso
│   ├── 01-requisitos.md           # REQ-xx em EARS; v1 / v2 / fora; config + onboarding por requisito
│   ├── 02-arquitetura.md          # ≤ 2 páginas; diagramas; aponta para os ADRs
│   ├── 03-roadmap.md              # fases F0..Fn; cada fase vira uma ou mais changes do OpenSpec
│   ├── decisions/0001-*.md        # ADRs (MADR 4.0)
│   ├── research/                  # ESTE estudo (00..06 + anexos)
│   └── handoffs/                  # passagem de turno ao pausar no meio de algo
├── openspec/
│   ├── config.yaml                # context + rules (abaixo)
│   ├── specs/…                    # comportamento atual, fonte da verdade
│   └── changes/<id>/…             # proposal · design · tasks · delta specs → archive/AAAA-MM-DD-<id>/
├── .pi/prompts/entrevista.md      # /entrevista no pi
├── .claude/commands/entrevista.md # /entrevista no Claude Code (mesmo arquivo)
└── .claude/settings.json          # opcional: hook que bloqueia Edit/Write em src/ com pergunta 🔴 aberta
```

### 1.4 Os arquivos de "cola" (a parte nossa)

**`AGENTS.md` do projeto de memória**, que traduz as suas regras em instruções verificáveis:

```markdown
# AGENTS.md — pi-obsidian-memory (nome provisório)
## Onde estamos
Leia docs/STATE.md antes de tudo: ele aponta a fase, a change ativa e a próxima ação.
## Regras de processo (obrigatórias)
1. Nenhum código de produção sem: change aprovada no OpenSpec E nenhuma pergunta 🔴 aberta em docs/OPEN-QUESTIONS.md.
2. Dúvida que afete escopo, comportamento observável, formato em disco ou dados do usuário → pergunte
   (uma por vez, opções + recomendação) e registre em docs/OPEN-QUESTIONS.md. Não assuma.
3. Todo requisito declara (a) sua configuração — chave, default, validação — e (b) seu passo no onboarding (/memory-setup).
4. Decisão difícil de reverter (formato em disco, API de tools, local dos dados) → ADR em docs/decisions/.
5. A realidade divergiu da spec → PARE: esperado / encontrado / impacto / como seguir? A spec vem antes do código.
6. Fim de tarefa: rode os testes e MOSTRE a saída; marque o checkbox; atualize docs/STATE.md; faça commit.
## Segurança de dados (OneDrive)
- Nunca grave SQLite, locks, temporários de recuperação ou .git dentro do vault/OneDrive.
- Nunca sobrescreva nota do vault sem leitura completa + hash. Nunca apague: mova para archive/.
## Comandos
- (preencher na F1: testes, typecheck, lint)
```

**`/entrevista`**, um prompt template que funciona igual no pi (`.pi/prompts/`) e no Claude Code (`.claude/commands/`):

```markdown
---
description: Entrevista de descoberta antes de qualquer spec ou código
---
Tema: $ARGUMENTS
1. ANTES de perguntar, leia docs/STATE.md, docs/OPEN-QUESTIONS.md, os docs relevantes e o código.
   Não pergunte o que dá para descobrir lendo.
2. UMA pergunta por mensagem, com 2–4 opções, prós e contras curtos e a sua recomendação (★). Aceite resposta livre.
3. Ordem: bloqueantes (🔴) > caras de reverter > o resto. Pule o óbvio; aprofunde onde eu hesitar.
4. Depois de cada resposta, atualize a linha em docs/OPEN-QUESTIONS.md (status + resolução).
   Decisão arquitetural → rascunho de ADR.
5. Quando acabar (ou quando eu disser "chega"): resuma as decisões, liste o que continua 🔴 e proponha
   o próximo artefato. NÃO escreva código.
```

**`openspec/config.yaml`**, com as regras injetadas em todo planejamento do OpenSpec:

```yaml
schema: spec-driven
context: |
  Extensão pi (TypeScript/ESM) que grava a memória do agente em vault(s) Obsidian no OneDrive (Windows 11).
  Docs de projeto em docs/ (visão, requisitos, ADRs, STATE, OPEN-QUESTIONS); pesquisa em docs/research/.
rules:
  proposal:
    - Liste "Perguntas em aberto". Se houver pergunta 🔴 ligada a esta change em docs/OPEN-QUESTIONS.md, PARE e pergunte.
    - Declare as chaves de configuração novas (nome, default, validação) e o passo do onboarding afetado.
  specs:
    - Requisitos com SHALL/MUST e pelo menos um cenário WHEN/THEN; cite o REQ-xx de docs/01-requisitos.md.
  design:
    - Toda escrita no vault usa leitura completa + hash + guarda de encolhimento; SQLite e locks nunca no OneDrive.
  tasks:
    - Cada tarefa cabe em uma sessão e traz o comando de verificação (ex.: npx vitest run <arquivo>).
```

### 1.5 O ritual

```text
UMA VEZ POR PROJETO
  pesquisa (este estudo) → /entrevista visão → 00-visao · 01-requisitos · 02-arquitetura · 03-roadmap · ADRs → VOCÊ APROVA

POR FASE / FEATURE
  /opsx:explore → /entrevista <tema> (se houver 🔴) → /opsx:propose → VOCÊ REVISA E APROVA
  → SESSÃO NOVA → /opsx:apply (1 tarefa por vez · TDD · mostra a saída · checkbox · STATE) → VOCÊ LÊ O DIFF
  → /opsx:verify (perfil expandido) → /opsx:archive
  (no pi os comandos usam hífen: /opsx-propose, /opsx-apply…)

SEMPRE
  contexto acima de ~60% ou troca de fase → atualizar STATE (ou handoff) → sessão nova
```

---

## Parte 2 — O projeto de memória: o que reaproveitar

### 2.1 A decisão que define todas as outras: o formato no vault (**Q-02**)

| Formato | Como fica no Obsidian | Consequência |
|---|---|---|
| **Manter o formato do pi-hermes-memory** (`MEMORY.md` único, entradas separadas por `§`, metadados em comentário HTML) | Um arquivo grande por escopo, pouco navegável, sem links nem propriedades. Toda escrita reescreve o arquivo inteiro, o que gera mais conflito no OneDrive | Favorece o **fork** (os testes continuam válidos) |
| **★ Formato nativo do Obsidian** (índice `MEMORY.md` + uma nota por memória com frontmatter, `id` estável, wikilinks e daily log por dispositivo) | Navegável, pesquisável, dá para ligar às suas notas e fazer dashboard com Bases | Favorece um **pacote novo** que reaproveita módulos |

### 2.2 Estratégia de reaproveitamento (**Q-01**)

**★ Pacote novo, Obsidian-first, reaproveitando módulos do pi-hermes-memory** (MIT, mantendo os avisos de copyright do Chandra Teja e da Nous Research). Os motivos:

1. A camada que teríamos de reescrever de qualquer jeito é justamente a que conflita com o OneDrive e com o formato nativo:
   - persistência em arquivo único;
   - hard links;
   - snapshots de recuperação;
   - lock SQLite na pasta pai;
   - `better-sqlite3` nativo.
2. O "cérebro" do pacote é modular e aproveitável: prompts, protocolo de review, detector de correção, flush, scanner e busca de sessões.
3. O upstream publica versões toda semana, e um fork profundo divergiria rápido.
4. Dá para **contribuir de volta** o que for genérico, como as correções de Windows (#245/#247, `split('/')`) e os prompts configuráveis (#229).

A alternativa é o **fork com refactor**, se a resposta do Q-02 for "manter o formato `§`". Detalhes em [03](03-pi-hermes-memory-anatomia.md#três-caminhos-de-reaproveitamento).

### 2.3 Mapa módulo a módulo (★ pacote novo)

| Origem | Módulo | Decisão | Motivo |
|---|---|---|---|
| pi-hermes-memory | `store/content-scanner.ts` | ♻️ **Reusar** | Bloqueia prompt injection e segredos. É ainda mais importante porque o vault é editado por humanos e por outros dispositivos |
| pi-hermes-memory | `constants.ts`: policy, descrições das tools, prompts de review, flush e correção | ♻️ **Reusar e adaptar** | Adaptar para pt-BR e para o vault (wikilinks, notas enxutas) e deixar configurável (#229) |
| pi-hermes-memory | `tools/*`: nomes e semântica de `memory_add/replace/remove/search` | ♻️ **Reusar a API** | Continuidade para quem usa o original. Acrescentar `id` estável (substring fica ambígua em escala) e `memory_get` |
| pi-hermes-memory | `prompt-context.ts` (`policy-only`) | ♻️ Reusar a ideia | Policy estável no system prompt, amigável ao cache |
| pi-hermes-memory | modo `legacy-inject` | ❌ Descartar | Inviável sem limites. No lugar: **active recall com orçamento** no evento `context` (ideia do PR #216) |
| pi-hermes-memory | `handlers/background-review.ts` + `review-memory-ops.ts` (JSON de operações) | ♻️ **Reusar** | É o motor de aprendizado. Usar `reviewRecentMessages` para não mandar o branch inteiro |
| pi-hermes-memory | `handlers/correction-detector.ts` | ♻️ Reusar e adaptar | Padrões em pt-BR, configuráveis |
| pi-hermes-memory | `handlers/session-flush.ts` | ♻️ Reusar | Flush antes da compactação e no encerramento |
| pi-hermes-memory | `store/fts-query.ts`, `schema.ts`, `sqlite-memory-store.ts` | 🔧 Adaptar | Stop-words pt-BR; tokenizer `unicode61 remove_diacritics 2`; dimensão "vault"; **`node:sqlite`** em vez de `better-sqlite3` (modelo do @pify/memory) |
| pi-hermes-memory | `store/db.ts` | 🔧 Adaptar | `dbPath` explícito e **local**; índice reconstruível a partir do vault |
| pi-hermes-memory | `store/session-indexer.ts` + `session-search*` | ♻️ Reusar e corrigir | Corrigir `cwd.split('/')` no Windows; manter o índice local |
| pi-hermes-memory | `store/memory-store.ts` (persistência) | 🔁 **Substituir** | Por `VaultBackend`: nota por memória, hash, `.tmp` + rename com retry, guarda de encolhimento, sem hard links, detecção de placeholder e de cópias de conflito |
| pi-hermes-memory | `markdown-mutation-lock.ts`, `atomic-lock-coordinator.ts` | 🔁 Substituir | Locks locais simples, sem o probe de PowerShell no load (#245) |
| pi-hermes-memory | `auto-consolidate.ts` (disparado por estouro de limite) | 🔁 Substituir | Consolidação e dedup **fora do fluxo**, com propostas em `inbox/` para você revisar no Obsidian |
| pi-hermes-memory | `config.ts` (JSON lido 1x, fallback silencioso) | 🔁 **Reescrever** | Schema versionado (TypeBox), erros visíveis, gravação atômica, config de máquina × config do vault |
| pi-hermes-memory | `/memory-interview` | ♻️ Reusar | Vira a etapa "perfil" do onboarding |
| pi-hermes-memory | `skill-store.ts`, `standing-instructions.ts` | ❓ Decidir (Q-G5) | Skills e regras fixas no vault ou locais? |
| pi-hermes-memory | Migrações (`extension-root`, `project-memory`) | ❌ Descartar | No lugar: **import** opcional das memórias existentes (Q-A4) |
| **novo** | `/memory-setup` (wizard) + `/memory-doctor` | 🆕 | `ctx.ui.select/input/confirm` + `ctx.reload()`; checklist do wizard em [04](04-memoria-obsidian-onedrive.md#auto-detecção-para-o-onboarding) |
| basic-memory (ideias, AGPL) | id estável, fatos atômicos, relações `[[wikilink]]`, `expected_checksum` | 💡 Reimplementar a ideia | Não copiar código (AGPL) |
| OpenClaw | Daily log + hoje/ontem no início, flush com `NO_REPLY`, ranking híbrido + decay + MMR | 💡 Ideias e constantes | Recuperação para memória ilimitada |
| Claude Code auto-memory / Letta | Índice de 1 linha por memória; `type`; `pinned`; `description` | 💡 Formato | Divulgação progressiva |
| @tenchi4u/pi-obsidian-memory (MIT) | Config do path do vault, notas para Windows, orçamento de snapshot | 🔍 Ler antes de começar | É o precedente mais próximo |
| kepano/obsidian-skills (MIT) | Skill `obsidian-markdown` (+ `obsidian-bases`) | ♻️ Empacotar ou referenciar | Faz o LLM escrever Obsidian Markdown válido; dashboard `.base` de memórias |

### 2.4 Arquitetura-alvo (rascunho)

```text
pi ── extensão ─┬─ tools: memory_add · memory_search · memory_get · memory_update · memory_forget (+ session_search, skill_manage?)
                ├─ eventos: session_start · before_agent_start (policy estável) · context (active recall com orçamento)
                │           turn_end (review) · session_before_compact (flush) · session_shutdown
                ├─ core: scanner · IDs · dedupe · ranking (BM25 + decay [+ vetor]) · consolidação → inbox/
                ├─ VaultBackend (FS-first): hash · tmp+rename com retry · guarda de encolhimento · placeholders · conflitos
                │     └─► <Vault>/Agent Memory/**.md        ← SÓ Markdown no OneDrive
                ├─ Index (node:sqlite FTS5 pt-BR) ─► ~/.pi/agent/<pacote>/index/   ← local (Q-C4)
                ├─ Config (schema versionado) ─► ~/.pi/agent/<pacote>/config.json (+ opcional: preferências no vault)
                └─ Onboarding: /memory-setup · /memory-doctor · (etapa perfil = /memory-interview)
[opcional] adaptador Obsidian CLI (app aberto): move/rename com atualização de links, backlinks
[opcional] Claude Code: servidor MCP ou skill sobre o mesmo core
```

### 2.5 Roadmap (rascunho: vira `docs/03-roadmap.md` depois das respostas)

| Fase | Entrega | Código? |
|---|---|---|
| **F0 Descoberta** | Respostas do [06](06-perguntas-abertas.md) → visão, requisitos (EARS), arquitetura, ADRs. Dois *spikes* descartáveis, só com sua autorização: **(a)** ler o código do pi-hermes-memory localmente para confirmar os pontos de corte; **(b)** testar o OneDrive de verdade numa pasta de teste (placeholder, rename, conflito, histórico de versões) | Não (os spikes são jogados fora) |
| **F1 Esqueleto + config + onboarding mínimo** | Pacote pi, schema de config, `/memory-setup` (vault + pasta + pin), `/memory-doctor` | Sim |
| **F2 VaultBackend seguro** | Formato de nota, leitura e escrita seguras, placeholders, conflitos, testes com vault temporário | Sim |
| **F3 Tools + índice** | `memory_add/search/get/update/forget`, FTS5 pt-BR, policy, scanner | Sim |
| **F4 Automação** | Review, correção em pt-BR, flush, active recall com orçamento | Sim |
| **F5 Obsidian e manutenção** | Consolidação (`inbox/`), dashboard `.base`, adaptador CLI opcional, import do pi-hermes-memory | Sim |
| **F6 Opcional** | Vetores multilíngues; exposição ao Claude Code (MCP/skill) | Sim |

### 2.6 Prompt de kickoff revisado (versão do seu prompt original)

```text
Projeto: memória de longo prazo para o pi reaproveitando o pi-hermes-memory, gravando em vault(s) Obsidian
no meu OneDrive, sem os limites atuais, 100% configurável e com onboarding de configuração.

Regras (não negociáveis):
1. Nenhum código antes de: pesquisa registrada, perguntas 🔴 respondidas em docs/OPEN-QUESTIONS.md e spec aprovada.
2. Todo requisito declara sua configuração e seu passo no onboarding.
3. docs/STATE.md diz onde estamos; atualize ao fim de cada etapa. Sessão nova a cada fase.

Já pesquisado: docs/research/ (estudo de 2026-09-23). Leia README.md, 03, 04 e 05 antes de tudo.

Etapa atual: F0 — DESCOBERTA.
- Me entreviste usando docs/research/06-perguntas-abertas.md como roteiro: uma pergunta por vez, com opções e
  a sua recomendação; pule o que eu já respondi; aprofunde onde eu hesitar.
- Registre cada resposta em docs/OPEN-QUESTIONS.md e cada decisão difícil de reverter como ADR em docs/decisions/.
- Ao final, proponha docs/00-visao.md, 01-requisitos.md (EARS; v1/v2/fora), 02-arquitetura.md e 03-roadmap.md,
  e PARE para a minha aprovação. Não escreva código.
```
