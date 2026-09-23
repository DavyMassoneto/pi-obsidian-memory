# B — Workflows "documentation-first / spec-driven" e padrões de context engineering para agentes de código (pi + Claude Code)

> Pesquisa realizada em **2026-09-23**. Escopo: workflows, práticas e padrões de *context engineering* (os toolkits grandes — Spec Kit, OpenSpec, Kiro, BMAD, Agent OS, Task Master — são cobertos por outro pesquisador e aparecem aqui só de passagem).
>
> Convenções:
> - **exemplo ilustrativo** = texto/estrutura escrito por mim, em palavras próprias, inspirado na fonte (não é cópia).
> - **não verificado** = não consegui confirmar em fonte primária.
> - Datas no formato AAAA-MM-DD. Versões indicadas quando encontradas.
> - Todo conteúdo de terceiros foi parafraseado; prompts aparecem como "gist" (resumo da intenção), não verbatim.

---

## Sumário

0. [Resumo executivo](#0-resumo-executivo)
1. [Anthropic — guias oficiais](#1-anthropic--guias-oficiais)
2. [obra/superpowers](#2-obrasuperpowers-jesse-vincent)
3. [GSD — Get Shit Done](#3-gsd--get-shit-done)
4. [HumanLayer — ACE / RPI → QRSPI](#4-humanlayer--advanced-context-engineering-rpi--qrspi)
5. [Harper Reed — "My LLM codegen workflow atm"](#5-harper-reed--my-llm-codegen-workflow-atm)
6. [Context Engineering template / PRP](#6-context-engineering-template--prp)
7. [AGENTS.md (+ como o pi e o Claude Code carregam contexto)](#7-agentsmd-padrão-aberto--carregamento-no-pi-e-no-claude-code)
8. [Cline Memory Bank](#8-cline-memory-bank)
9. [Formatos de apoio (ADR/MADR, EARS, decision log, open questions, llms.txt, outros)](#9-formatos-de-apoio)
10. [Críticas e evidências](#10-críticas-e-evidências)
11. [Síntese: padrões recorrentes (checklist prático)](#11-síntese-padrões-recorrentes--checklist-prático)
12. [Esboço de aplicação para pi + Claude Code](#12-esboço-de-aplicação-para-pi--claude-code)
13. [Fontes consolidadas](#13-fontes-consolidadas)

---

## 0. Resumo executivo

Todas as fontes convergem para o mesmo núcleo:

1. **Contexto é recurso escasso e degrada** (*context rot*). O que precisa sobreviver entre sessões deve morar em **arquivos versionados** (spec, plano, estado, decisões), não na conversa.
2. **Antes de codar, o agente entrevista** o humano (uma pergunta por vez, ou em rodadas com resposta recomendada), e o resultado vira uma **spec curta** com fora-de-escopo, decisões, questões em aberto e critério de verificação end-to-end.
3. **Implementação acontece em contexto novo**, a partir de um **plano com tarefas pequenas, verificáveis e com checkbox**, uma tarefa/feature por vez.
4. Um **arquivo de estado/progresso + git** permite retomar sem "memória" (o agente relê o estado, o log e a próxima tarefa).
5. **Verificação executável** (testes, E2E, TDD) e **revisão por um agente separado** substituem a auto-avaliação otimista.

A Anthropic oficializa isso: entrevista via `AskUserQuestion` → `SPEC.md` → sessão nova; explore → plan → implement → commit com *plan mode*; `CLAUDE.md` curto (< 200 linhas); para tarefas longas, *initializer agent* + `feature_list.json` (só o campo `passes` muda) + `claude-progress.txt` + `init.sh` + git, uma feature por vez. **Superpowers** (v6.4.1, 2026-09-18; roda no pi via `pi install git:github.com/obra/superpowers`) impõe um *hard gate*: brainstorming → design doc aprovado → plano com tarefas de 2–5 min em TDD → execução com *ledger*. **GSD** (hoje GSD Core v1.14.0; o GSD 2 é uma CLI construída sobre o **Pi SDK**) formaliza `PROJECT/REQUIREMENTS/ROADMAP/STATE` + `CONTEXT/PLAN` por fase, com executores em contexto limpo. A **HumanLayer** constatou que RPI com planos de ~1.000 linhas falha porque humanos não os leem; em 2026 migrou para **QRSPI**: perguntas → pesquisa "cega" → *design discussion* de ~200 linhas (principal ponto de revisão) → outline → plano → fatias verticais → ler o código. **Harper Reed** e **PRP** são variantes leves (`spec.md` → `prompt_plan.md` → `todo.md`; `INITIAL.md` → PRP → execução). **Cline Memory Bank** e **AGENTS.md** cobrem a memória do projeto — mas a evidência (ETH Zurich, 2026: arquivos gerados por LLM não ajudam ou pioram e todos custam ~20% mais tokens; Thoughtworks: "agent instruction bloat" em Caution) pede arquivos mínimos, escritos por humanos, só com o que não se infere do código.

As críticas (Böckeler, Thoughtworks, Marmelab, Kent Beck) dizem que SDD pesado vira *waterfall com markdown*: revisão dupla, falsa sensação de controle, *spec drift*. Estudos de 2026 indicam ganho grande de spec em modelos mais fracos e domínios de alto risco, e ganho pequeno em tarefas simples com modelos fortes. **Recomendação:** dimensionar o processo ao problema (trivial → direto; pequeno → mini-design no chat; feature → spec + plano; projeto/sistema crítico → fases, ADRs, rastreabilidade), revisar artefatos **curtos e cedo**, e continuar lendo o código.

### Mapa rápido

| Abordagem | Artefatos principais | (a) Perguntas antes de codar | (b) Orientação entre sessões | Peso |
|---|---|---|---|---|
| Anthropic best practices | `CLAUDE.md`, `SPEC.md`, plano (plan mode) | Entrevista com `AskUserQuestion`; plan mode | CLAUDE.md + auto memory + spec/plano em disco + sessão nova | Leve |
| Anthropic long-running harness | `feature_list.json`, `claude-progress.txt`, `init.sh`, git | Spec inicial (`app_spec.txt`) escrita antes | Rotina de "get your bearings" + git log + progress | Médio |
| Superpowers | `docs/superpowers/specs/…-design.md`, `…/plans/…md`, ledger `progress.md` | Brainstorming com hard gate, 1 pergunta/mensagem | Spec + plano + ledger + commits por tarefa | Médio/alto |
| GSD | `.planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md`, fases com `CONTEXT/PLAN/SUMMARY` | new-project (questionamento profundo), discuss-phase, spec-phase | `STATE.md` < 100 linhas, `HANDOFF.json`, executores em contexto novo | Alto |
| HumanLayer RPI/QRSPI | `thoughts/shared/{research,plans,handoffs}` | Perguntas só do que o código não responde; design discussion | Compactação intencional em arquivo; handoff/resume | Médio |
| Harper Reed | `spec.md`, `prompt_plan.md`, `todo.md` | "Uma pergunta por vez" até a spec | Checklists marcadas + commits | Leve |
| PRP | `INITIAL.md`, `PRPs/*.md` | Fraco (humano escreve INITIAL.md; PRP pesquisa) | PRP autocontido + validação em níveis | Médio |
| AGENTS.md | `AGENTS.md` (aninhável) | — | Instruções persistentes carregadas no início | Leve |
| Cline Memory Bank | 6 arquivos em `memory-bank/` | Plan mode | Ler TODOS os arquivos no início de cada tarefa | Médio |

---

## 1. Anthropic — guias oficiais

### 1.1 Claude Code — *Best practices* (docs oficiais, 2026)

- **Fonte:** <https://code.claude.com/docs/en/best-practices> (o post original de abr/2025, `anthropic.com/engineering/claude-code-best-practices`, hoje redireciona com HTTP 308 para essa página). Consultado em 2026-09-23; a página não traz data.
- **Premissa central:** a janela de contexto é o recurso mais importante; o desempenho cai à medida que ela enche (o modelo "esquece" instruções antigas e erra mais).

#### Técnica "deixe o Claude te entrevistar" → `SPEC.md` → sessão nova

- Para features maiores: comece com um prompt mínimo e peça que o Claude **te entreviste usando a ferramenta `AskUserQuestion`**, cobrindo implementação técnica, UI/UX, casos de borda, preocupações e tradeoffs, **evitando perguntas óbvias** e cavando as partes difíceis; ao cobrir tudo, ele escreve a spec completa em `SPEC.md`.
- Com a spec pronta, **inicie uma sessão nova para implementar**: contexto limpo, focado só em implementação, com a spec escrita como referência.
- As specs mais úteis são **autocontidas**: nomeiam arquivos e interfaces, dizem **o que está fora de escopo** e terminam com um **passo de verificação end-to-end**. Tempo gasto tornando a spec precisa rende mais do que tempo gasto assistindo a implementação.

```text
# Prompt de entrevista — exemplo ilustrativo (paráfrase em PT do padrão da doc)
Quero construir <descrição curta>. Me entreviste em detalhe usando a ferramenta AskUserQuestion.
Cubra implementação técnica, UI/UX, casos de borda, riscos e tradeoffs.
Não pergunte o óbvio; foque nas partes difíceis que eu talvez não tenha considerado.
Continue até cobrirmos tudo e então escreva a especificação completa em SPEC.md.
```

```markdown
<!-- SPEC.md — exemplo ilustrativo seguindo as recomendações da doc -->
# SPEC: <feature>
status: draft            # draft | approved (data + quem aprovou)
## Objetivo e contexto
## Escopo
### Dentro
### Fora de escopo
## Requisitos (R-01, R-02, …)
## Interfaces e arquivos envolvidos (paths, assinaturas, contratos)
## Decisões (link para ADRs quando houver)
## Questões em aberto (tem que estar vazia antes de implementar)
## Casos de borda
## Verificação end-to-end (comando/roteiro que prova que a feature funciona)
```

#### Explore → Plan → Implement → Commit (com *plan mode*)

1. **Explore** em plan mode: `Shift+Tab` até aparecer "plan mode on", ou `claude --permission-mode plan`, ou prefixe um único prompt com `/plan`. O Claude lê arquivos e responde sem editar.
2. **Plan:** peça um plano detalhado; `Ctrl+G` abre o plano no seu editor para editar antes de prosseguir.
3. **Implement:** ao aprovar o plano você escolhe: "sim + auto mode", "sim, aprovar edições manualmente" ou "não, continuar planejando". Com `showClearContextOnPlanAccept` habilitado aparece a opção de **aprovar e limpar o contexto de planejamento** (contexto novo para implementar).
4. **Commit:** mensagem descritiva + PR.

- Plan mode tem custo: se você consegue **descrever o diff em uma frase, pule o plano**. Ele vale quando há incerteza de abordagem, mudança em vários arquivos ou código desconhecido.
- Configurações úteis (docs de permission modes / settings): `permissions.defaultMode: "plan"` em `.claude/settings.json` para começar sempre em plan mode; `plansDirectory` define onde os planos são gravados (**valor default não verificado**).

#### `CLAUDE.md` e memória (docs "How Claude remembers your project")

- Lido no início de toda sessão; sem formato obrigatório; **curto e legível** — alvo **< 200 linhas por arquivo**. Teste por linha: "remover isto faria o Claude errar?" Se não, corte. `CLAUDE.md` inchado faz o Claude ignorar instruções. `/doctor` sugere cortes para o que é derivável do código.
- **Incluir:** comandos que o Claude não adivinha; estilo que difere do padrão; como rodar testes; etiqueta do repo (branches, PRs); decisões arquiteturais específicas; peculiaridades do ambiente; *gotchas*.
- **Excluir:** o que dá para inferir lendo código; convenções-padrão da linguagem; documentação de API detalhada (linkar); informação que muda com frequência; tutoriais; descrição arquivo-a-arquivo; obviedades ("escreva código limpo").
- **Locais** (do mais amplo ao mais específico, concatenados): managed policy (no Windows `C:\Program Files\ClaudeCode\CLAUDE.md`) → `~/.claude/CLAUDE.md` → `./CLAUDE.md` ou `./.claude/CLAUDE.md` → `./CLAUDE.local.md` (pessoal, no `.gitignore`). Carrega do cwd para cima na partida; `CLAUDE.md` de subdiretórios entram **sob demanda** quando o Claude lê arquivos ali.
- `@path/arquivo` importa outros arquivos (relativo ao arquivo que importa; até 4 saltos). **Import não economiza contexto** — tudo entra na partida.
- `.claude/rules/*.md` com frontmatter `paths:` carrega regras **só quando** o Claude mexe em arquivos que casam com o padrão (boa forma de manter o arquivo principal curto).
- Comentários HTML de bloco (`<!-- -->`) são removidos antes de injetar (notas para humanos sem custo de tokens).
- O `CLAUDE.md` da raiz **sobrevive ao `/compact`** (é relido do disco). Dá para instruir a compactação, ex.: "ao compactar, preserve a lista de arquivos modificados e os comandos de teste".
- **Auto memory:** o Claude mantém `MEMORY.md` (índice) + arquivos por tópico por repositório; as primeiras **200 linhas ou 25 KB** entram em toda sessão.
- `/init` gera um `CLAUDE.md` inicial; com `CLAUDE_CODE_NEW_INIT=1` o `/init` vira um fluxo interativo que explora o código com subagente, **faz perguntas de acompanhamento** e mostra uma proposta antes de escrever.
- **Hooks** para o que precisa acontecer sempre: `CLAUDE.md` é consultivo; hooks são determinísticos.

#### Verificação

- Dê ao Claude um **check executável** (testes, build, linter, script que compara saída, screenshot). Sem check, "parece pronto" é o único sinal.
- Níveis de "gate": pedir no próprio prompt; condição `/goal` na sessão (um avaliador re-checa a cada turno); **Stop hook** como gate determinístico (o Claude Code encerra o turno após 8 bloqueios consecutivos); **subagente verificador** em contexto novo (revisar o diff contra `PLAN.md`: cada requisito implementado, casos de borda com teste, nada fora de escopo).
- Cuidado: um revisor instruído a achar problemas sempre acha algo → peça só gaps de **correção ou requisitos**; o resto é opcional (evita over-engineering).
- Peça **evidência** (saída de teste, comando executado, screenshot), não afirmação.

#### Gestão de sessão e padrões de falha

- `Esc` interrompe; `Esc+Esc`/`/rewind` restaura conversa e/ou código a um checkpoint ou resume a partir de um ponto; `/clear` entre tarefas não relacionadas; após **duas correções falhas no mesmo problema**, `/clear` e recomece com prompt melhor; `/compact <instruções>`; `/btw` para perguntas que não devem entrar no histórico; **subagentes para investigação** (mantêm o contexto principal limpo); checkpoints **não substituem git**; `claude --continue` / `--resume`, `/rename` para tratar sessões como branches.
- Anti-padrões nomeados: sessão "pia de cozinha" (tarefas misturadas), corrigir repetidamente, `CLAUDE.md` superespecificado, lacuna "confiar-depois-verificar", exploração infinita.

**(a) Perguntas antes de codar:** entrevista com `AskUserQuestion`; plan mode (sem edição até aprovar); `/init` interativo.
**(b) Orientação entre sessões:** `CLAUDE.md` + auto memory + `SPEC.md`/plano em disco + sessões nomeadas + git.
**Prós:** oficial, leve, compatível com qualquer stack; bom equilíbrio entre gate humano e autonomia. **Contras:** é um conjunto de práticas, não um processo — a disciplina (manter spec/estado atualizados, pular plano quando trivial) fica com você; `AskUserQuestion` e plan mode são recursos do Claude Code (no pi é preciso extensão/prompt).

### 1.2 "Effective context engineering for AI agents" (2025-09-29)

- **Fonte:** <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents> — Applied AI team (Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield e colaboradores).
- **Definição:** context engineering é curar e manter o conjunto ótimo de tokens durante a inferência (system prompt, ferramentas, dados externos, histórico) — evolução de prompt engineering para agentes multi-turno.
- **Context rot / attention budget:** o desempenho cai com o tamanho do contexto (relações par-a-par crescem ~n²); trate contexto como recurso finito com retorno marginal decrescente. Regra-mestra: **o menor conjunto de tokens de alto sinal** que maximiza o resultado.
- **System prompt na "altitude certa":** nem lógica hard-coded frágil, nem vagueza que presume contexto compartilhado; seções claras (XML/Markdown).
- **Ferramentas:** poucas, sem sobreposição, autoexplicativas. **Exemplos:** poucos e canônicos, em vez de listas de casos de borda.
- **Recuperação "just in time"** (paths, queries, links carregados sob demanda) + **estratégia híbrida** — o Claude Code carrega `CLAUDE.md` de cara e usa glob/grep para o resto.
- **Técnicas de longo horizonte:**
  - **Compaction:** resumir o histórico perto do limite e reiniciar; equilibrar *recall* vs *precision*; o mais seguro é limpar resultados brutos de ferramentas já processados.
  - **Structured note-taking / agentic memory:** o agente escreve notas persistentes fora da janela (ex.: `NOTES.md`, to-do list) e as relê — exemplo do agente jogando Pokémon que manteve contagens precisas por milhares de passos.
  - **Sub-agentes:** exploram com contexto limpo e devolvem resumos condensados (~1.000–2.000 tokens) ao coordenador.
- **Casamento técnica × tarefa:** compaction para longas trocas; notas para desenvolvimento iterativo; multi-agente para pesquisa complexa.

**Implicação prática para o seu fluxo:** o "arquivo de estado" (STATE/progress/NOTES) é a forma oficial de *structured note-taking*; `AGENTS.md`/`CLAUDE.md` = parte pré-carregada; `docs/` linkados = just-in-time.

### 1.3 "Effective harnesses for long-running agents" (2025-11-26)

- **Fonte:** <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents> — Justin Young (+ colaboradores). Código: <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>.
- **Problema:** o agente trabalha em sessões discretas e cada sessão começa sem memória — como engenheiros em turnos sem passagem de turno. Falhas típicas: tentar fazer tudo de uma vez (*one-shot*), declarar vitória cedo, deixar o repo quebrado, marcar feature como feita sem testar, não saber rodar o app.
- **Solução em duas partes:**
  1. **Initializer agent** (primeira sessão, prompt próprio): lê a spec (`app_spec.txt`), cria **feature list em JSON** (no exemplo, ≥ 200 itens, todos inicialmente falhando), cria `init.sh`, `claude-progress.txt`, estrutura de diretórios e faz o **commit inicial**.
  2. **Coding agent** (todas as sessões seguintes): progresso incremental, **uma feature por vez**, deixa o ambiente limpo (pronto para merge), commita com mensagem descritiva e atualiza o progresso.
- **Por que JSON e não Markdown:** o modelo tende menos a reescrever/estragar JSON. A regra é editar **apenas o campo `passes`**; instruções enfáticas proíbem remover/editar/reordenar/combinar testes.

```json
// feature_list.json — exemplo ilustrativo. Campos do artigo: category, description, steps, passes.
// ("id" foi acrescentado por mim para rastreabilidade.)
[
  {
    "id": "F-012",
    "category": "functional",
    "description": "Usuário exporta o relatório mensal em CSV",
    "steps": [
      "Abrir a tela de relatórios",
      "Selecionar o mês 2026-08",
      "Clicar em 'Exportar CSV'",
      "Verificar que o arquivo tem cabeçalho e uma linha por lançamento"
    ],
    "passes": false
  }
]
```

```text
# claude-progress.txt — exemplo ilustrativo
## Sessão 2026-09-23 #7
Feito: F-010, F-011 (passes=true; verificados com automação de browser)
Em andamento: F-012 (export CSV) — falta BOM UTF-8 para o Excel
Bloqueios: nenhum
Próximo: concluir F-012; depois F-013 (filtro por categoria)
Como rodar: ./init.sh (API :8080, web :3000)
```

- **Rotina de início de cada sessão** (o artigo mostra o agente "se situando"): `pwd` → ler `claude-progress.txt` e `git log` → ler a feature list e escolher a feature de **maior prioridade ainda falhando** → rodar `init.sh` → **teste E2E básico** (o quickstart manda re-testar 1–2 features já passando para pegar regressões **antes** de trabalho novo) → implementar → verificar → marcar `passes` → commit → atualizar progresso → encerrar limpo.
- **Testes:** com ferramentas de automação de browser (Puppeteer MCP no artigo) o agente achou bugs invisíveis no código; limitação citada: não enxergava modais nativos do browser.

| Falha | Correção no initializer | Correção no coding agent |
|---|---|---|
| Declara vitória cedo | Feature list abrangente | Ler a lista no início; uma feature por vez |
| Deixa estado quebrado/sem registro | Repo git + notas de progresso | Começar lendo progresso e rodando testes; terminar com commit + update |
| Marca feature sem testar | Feature list | Autoverificação E2E; só marcar após testar |
| Não sabe rodar o app | `init.sh` | Ler/rodar `init.sh` no início |

- **Trabalho futuro citado:** se um agente generalista é melhor que arquitetura multi-agente (agentes de teste, QA, limpeza); generalizar para além de web apps.

### 1.4 "Harness design for long-running application development" (2026-03-24)

- **Fonte:** <https://www.anthropic.com/engineering/harness-design-long-running-apps> — Prithvi Rajasekaran (Anthropic Labs).
- **Arquitetura de 3 agentes (inspirada em GAN):**
  - **Planner:** expande um prompt de 1–4 frases numa spec de produto ambiciosa, focada em **contexto de produto e design técnico de alto nível**, e **não** em detalhes de implementação (detalhe técnico prematuro gera erros em cascata).
  - **Generator:** implementa feature a feature contra a spec.
  - **Evaluator:** com Playwright MCP interage com a página viva e dá nota contra critérios predefinidos.
- **Sprint contract:** antes de cada sprint o generator propõe o que vai construir e **como o sucesso será medido**; o evaluator revisa e ambos iteram até concordar — ponte entre user story e implementação testável.
- **Comunicação via arquivos** (um agente escreve, o outro lê e responde).
- **Context reset vs compaction:** reset completo eliminava a "ansiedade de contexto" (o modelo encerrando cedo) no Sonnet 4.5; compaction não resolvia. Com **Opus 4.6** removeram sprints e avaliação por sprint — ficou planner + generator + avaliação única no fim.
- **Lições:** comece pela solução mais simples e só aumente a complexidade quando necessário; **cada componente do harness codifica uma suposição sobre o que o modelo não consegue fazer** — reavalie a cada modelo novo. Separar quem gera de quem avalia importa porque agentes superestimam o próprio trabalho.

**(a)** Nos harnesses longos, as perguntas acontecem **antes** (spec humana ou planner) e via *sprint contract* (acordo de critério antes de construir). **(b)** Orientação = arquivos (feature list, progress, specs, contratos) + git + rotina de reorientação + resets de contexto.
**Prós:** padrões concretos e testados; JSON "à prova de reescrita"; foco em verificação E2E. **Contras:** otimizado para web apps full-stack greenfield; custo alto em tempo e tokens (resumos secundários do artigo de 2026 citam ~4 h e ~US$ 124 para um app de exemplo — **não verificado na fonte primária**); feature list gigante pode virar "spec congelada".

---

## 2. obra/superpowers (Jesse Vincent)

- **Fonte:** <https://github.com/obra/superpowers> — **v6.4.1 (2026-09-18)**, ~290k stars. Release notes: v6.3.0 (2026-08-12) escalou a "cerimônia" do brainstorming à complexidade; v6.2.0 (2026-07-23) criou workspace por plano em `.superpowers/sdd/<plan-basename>/`; v6.4.1 reconstruiu `executing-plans` como execução inline mais barata.
- **Plataformas:** Claude Code (marketplace oficial: `/plugin install superpowers@claude-plugins-official`, ou `obra/superpowers-marketplace`), Codex, Cursor, Gemini CLI, Copilot CLI, OpenCode, **Pi**, Qwen Code, Factory Droid e outros.
- **No pi:** `pi install git:github.com/obra/superpowers` (ou `pi -e /caminho/local`). Segundo o README, o pacote Pi carrega as skills nativamente e injeta o bootstrap `using-superpowers` **na partida e após compactação**. No catálogo pi.dev há ports/derivados comunitários (`pi-superpowers`, `pi-superpowers-plus` — mais opinativo, pode bloquear comandos de "ship" até a verificação passar —, `superpowers-zh`, `@weiping/pi-superpowers`, `pi-supergsd`, `@teelicht/pi-superagents` etc.; **não auditados**).
- **Filosofia:** TDD sempre; sistemático em vez de ad hoc; reduzir complexidade; **evidência antes de afirmação**. As skills disparam automaticamente — são tratadas como fluxos obrigatórios, não sugestões.

**Workflow:** `brainstorming` → `using-git-worktrees` → `writing-plans` → `subagent-driven-development` **ou** `executing-plans` → `test-driven-development` → `requesting-code-review` → `finishing-a-development-branch`.

### 2.1 `brainstorming` (ideia → design aprovado)

- **Hard gate:** nenhum código, scaffold, dependência ou ação de implementação antes de cumprir a aprovação do caminho escolhido.
- **Classificação inicial (v6.3+):**
  - **Spike** (pergunta de viabilidade): propõe uma sonda curta, pede aprovação, investiga barato, reporta. Sem design doc.
  - **Bounded** (mudança pequena num fluxo existente): perguntas de esclarecimento → design curto **no chat** → aprovação explícita → implementa. Sem spec nem plano em arquivo.
  - **Architectural** (projeto/subsistema novo): processo completo abaixo. Se aparecer complexidade escondida no meio, **sobe de categoria** imediatamente.
- **Processo arquitetural:** explorar contexto (arquivos, docs, commits recentes) → refletir o entendimento e pedir correção → **uma pergunta por mensagem**, de preferência **múltipla escolha** → propor **2–3 abordagens com tradeoffs** e recomendação → apresentar o design **em seções** (arquitetura, componentes, fluxo de dados, tratamento de erros, testes), cada uma do tamanho da complexidade (de poucas frases a ~200–300 palavras), **perguntando após cada seção se está certo** → YAGNI implacável → escrever spec em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` e **commitar** → **self-review** (placeholders/TBD, contradições, escopo grande demais para um plano, requisitos ambíguos) → **usuário revisa a spec** → só então `writing-plans` (nenhuma outra skill de implementação).
- Projeto com vários subsistemas independentes → decompor em sub-projetos antes. "Visual companion" (mockups no browser) é oferecido só quando uma pergunta se beneficia de visual.

```markdown
<!-- docs/superpowers/specs/2026-09-23-exportacao-csv-design.md — exemplo ilustrativo -->
# Design: Exportação de relatórios em CSV
Data: 2026-09-23 · Status: aprovado pelo usuário em 2026-09-23
## Entendimento (o que o usuário quer e por quê)
## Abordagens consideradas (A/B/C com tradeoffs) → escolhida: B (motivo)
## Arquitetura
## Componentes (responsabilidade de cada um)
## Fluxo de dados
## Tratamento de erros
## Estratégia de testes
## Fora de escopo (YAGNI)
```

### 2.2 `writing-plans` (design → plano executável)

- Presume um executor **competente, sem nenhum contexto do código e com gosto questionável para testes** → o plano precisa ser explícito.
- Tarefas de **2–5 minutos**, com **código real** (nada de "TBD", "adicionar validação"); **mapa de arquivos antes das tarefas**; um plano por subsistema; cada plano gera software testável sozinho.
- Cabeçalho obrigatório: título; nota para agentes indicando a sub-skill obrigatória de execução; **Goal** (1 frase); **Architecture** (2–3 frases); **Tech Stack**; **Spec** (path do design); **Global Constraints**; **Review Focus** (as ~5 classes de entrada/falha mais prováveis de ficarem sem cobertura — v6.4).
- Cada tarefa: **Files** (create/modify/test), **Interfaces** (assinaturas consumidas e produzidas — é onde a tarefa vizinha aprende o contrato), **Steps** com checkbox no ciclo TDD.
- Salvo em `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`; self-review (cobertura da spec, consistência de tipos, Review Focus com testes) antes do handoff.

```markdown
<!-- docs/superpowers/plans/2026-09-23-exportacao-csv.md — exemplo ilustrativo -->
# Exportação CSV — Plano de implementação
> Para agentes: execute com a skill de execução indicada (subagent-driven ou inline).
Goal: permitir exportar o relatório mensal em CSV.
Architecture: serviço puro gera linhas; endpoint streama o arquivo; UI só dispara download.
Tech Stack: Node 22, Fastify, Vitest.
Spec: docs/superpowers/specs/2026-09-23-exportacao-csv-design.md
Global Constraints: UTF-8 com BOM; separador ';' (pt-BR).
Review Focus: meses sem lançamentos; valores negativos; acentos; arquivo > 50k linhas; timezone.

## Estrutura de arquivos
- src/reports/csv.ts (novo) — serialização
- src/routes/reports.ts (alterar) — endpoint

### Task 1: serializar lançamentos
Files: Create src/reports/csv.ts · Test tests/reports/csv.test.ts
Interfaces: produz `toCsv(rows: Lancamento[]): string`
- [ ] Escrever teste falhando (mês com 2 lançamentos, um com acento)
- [ ] Rodar `npx vitest run tests/reports/csv.test.ts` e ver FALHAR pelo motivo certo
- [ ] Implementar o mínimo
- [ ] Rodar de novo e ver PASSAR (suite inteira verde)
- [ ] Commit: "feat(reports): serializa lançamentos em CSV"
```

### 2.3 Execução: `subagent-driven-development` × `executing-plans`

- **Subagent-driven:** um subagente implementador **novo por tarefa** → revisão de **conformidade com a spec** + revisão de **qualidade** por tarefa → revisão final do branch inteiro. O subagente **não lê o plano inteiro** (um script extrai o brief da tarefa). Um **ledger** `progress.md` no workspace registra conclusões, rodadas de correção e decisões ("rulings") — é o mapa de recuperação quando o contexto do controlador se perde (os commits citados existem no git). Status do implementador: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Até 5 rodadas de correção com *circuit breaker*.
- **Executing-plans (inline, mais barato):** lê plano e spec (a **spec é a autoridade**), faz varredura prévia de conflitos e registra decisões, executa todas as tarefas sem pedir "posso continuar?", mantém ledger em arquivo (não na memória da conversa), **todo desvio vai para o ledger**; só para em ações irreversíveis, sensíveis de segurança, efeitos fora do worktree ou plano irremediavelmente quebrado; revisão final e correção de achados críticos.
- **`test-driven-development`:** "Iron Law" — nenhum código de produção sem teste falhando antes; código escrito antes do teste é **apagado**; teste que passa de primeira é sinal de alerta; exceções (protótipo descartável, código gerado, config) só com o humano.
- **`verification-before-completion`:** identificar o comando que prova a afirmação → rodar agora → ler saída e exit code → conferir → só então afirmar, com evidência. "Deve funcionar"/"provavelmente passa" são red flags.

**(a) Perguntas:** o brainstorming é o gate mais explícito do ecossistema (1 pergunta/mensagem, múltipla escolha, validação por seção + revisão da spec escrita). **(b) Orientação:** spec + plano versionados em `docs/superpowers/`, ledger em arquivo, worktree dedicado, commit por tarefa, bootstrap reinjetado após compactação (no pi).
**Prós:** disciplina forte (TDD, evidência, revisão independente); cerimônia escalável (spike/bounded/architectural); portável (inclui pi). **Contras:** muito opinativo (skills "obrigatórias" podem brigar com seu fluxo); subagent-driven é caro em tokens; planos com código completo ficam longos (há discussão pública sobre eficiência — issue #512, conteúdo **não verificado**); a pasta `docs/superpowers/` é convenção do framework (configurável pela preferência do usuário, segundo a skill).

**Fontes:** repo e skills em `skills/brainstorming`, `skills/writing-plans`, `skills/subagent-driven-development`, `skills/executing-plans`, `skills/test-driven-development`, `skills/verification-before-completion`; `RELEASE-NOTES.md`; catálogo <https://pi.dev/packages?name=superpowers>.

---

## 3. GSD — Get Shit Done

- **Histórico:** criado por TÂCHES (`glittercowboy`) como sistema de meta-prompting/context engineering/SDD para Claude Code; repo migrou para `gsd-build/get-shit-done`, que foi **arquivado em 2026-06-26**. Continua como:
  - **GSD Core** — <https://github.com/open-gsd/gsd-core> — **v1.14.0 (2026-09-14)**, ~9.8k stars, MIT, `npx @opengsd/gsd-core@latest`. Runtimes: Claude Code, OpenCode, Codex, Copilot, Cursor, Windsurf, Kimi CLI, Kilo, Antigravity (o **pi não aparece** na lista). Tem documentação em **pt-BR** (`docs/pt-BR/`).
  - **GSD 2 / gsd-pi** — <https://github.com/open-gsd/gsd-pi> — **v1.20.1**; CLI própria **construída sobre o Pi SDK** (`npx @opengsd/gsd-pi@latest`), estado em `.gsd/`, hierarquia milestone → slice → task, "auto mode" que cria **uma sessão nova por unidade de trabalho** com só os artefatos necessários pré-injetados, recuperação de crash e detecção de loop travado.
  - Ports comunitários para o pi: `pi-gsd` (`pi install npm:pi-gsd`), `yurifrl/pi-gsd-core` etc. (**não auditados**).
- **Comandos:** no original eram `/gsd:…`; no GSD Core são `/gsd-…`.

### 3.1 Loop e comandos principais (GSD Core)

Loop por fase: **discuss → plan → execute → verify → ship**.

```text
/gsd-new-project → /gsd-discuss-phase 1 → /gsd-plan-phase 1 → /gsd-execute-phase 1 → /gsd-verify-work 1 → /gsd-ship 1 → (próxima fase)
Fim do milestone: /gsd-audit-milestone → /gsd-complete-milestone → /gsd-new-milestone
Brownfield: /gsd-onboard ou /gsd-map-codebase · Ad hoc: /gsd-quick · Retomada: /gsd-progress, /gsd-next, /gsd-pause-work, /gsd-resume-work
Outros: /gsd-spec-phase (questionamento socrático → SPEC da fase), /gsd-explore, /gsd-spike, /gsd-sketch, /gsd-debug, /gsd-ingest-docs (importa ADRs/PRDs/SPECs existentes), /gsd-health
```

### 3.2 Arquivos criados

```text
.planning/
├── PROJECT.md          # visão, escopo, valor central (sempre carregado)
├── REQUIREMENTS.md     # requisitos com IDs: v1 (compromisso), v2 (futuro), fora de escopo
├── ROADMAP.md          # fases e status
├── STATE.md            # < 100 linhas: posição atual, decisões (D-01…), bloqueios, continuidade
├── config.json         # toggles de workflow, perfil de modelos
├── MILESTONES.md       # arquivo de marcos concluídos
├── HANDOFF.json        # pausa/retomada estruturada (/gsd-pause-work)
├── codebase/           # mapeamento de brownfield
├── research/  spikes/  sketches/  quick/  debug/  todos/
└── phases/
    └── 01-autenticacao/
        ├── 01-CONTEXT.md         # decisões da discuss-phase
        ├── 01-RESEARCH.md
        ├── 01-01-PLAN.md         # plano atômico (2–3 tarefas)
        ├── 01-01-SUMMARY.md      # resultado + decisões
        ├── 01-VERIFICATION.md
        └── 01-UAT.md
```

- **`STATE.md`** — digest (não arquivo morto) com limite de **< 100 linhas**: referência ao projeto, posição atual (fase/plano/status/barra de progresso), métricas, contexto acumulado (decisões recentes, pendências, bloqueios) e **continuidade de sessão** (última sessão, onde parou, arquivo de retomada). **É o primeiro passo de todo workflow** e é atualizado após cada ação significativa; decisões/bloqueios resolvidos são podados.
- **`CONTEXT.md` (discuss-phase)** — responde "o que está travado e o que é flexível?":

```markdown
<!-- .planning/phases/02-relatorios/02-CONTEXT.md — exemplo ilustrativo -->
## Fronteira da fase
Entrega: relatórios mensais e export CSV. NÃO inclui: dashboards, PDF.
## Decisões de implementação
- Layout em cards, não em linha do tempo
- Falha de rede: 3 tentativas e depois erro visível
## A critério do agente (Claude's Discretion)
- Nome interno dos componentes; biblioteca de CSV
## Ideias específicas ("quero como o app X")
## Referências canônicas (OBRIGATÓRIO): docs/decisions/0003-formato-moeda.md
## Ideias adiadas (fora desta fase)
- Export em XLSX (fase futura)
```

- **`PLAN.md`** — frontmatter + seções em XML; **2–3 tarefas por plano**, dimensionado para **~50% do contexto de um executor**; metodologia *goal-backward* (objetivo → verdades observáveis → artefatos → ligações críticas). Um *plan-checker* valida; o *source grounding* confere se símbolos citados (funções, flags) existem no código antes de executar.

```xml
<!-- 02-01-PLAN.md — exemplo ilustrativo -->
---
phase: 02-relatorios
plan: 01
type: execute          # ou tdd
wave: 1
depends_on: []
files_modified: [src/reports/csv.ts, src/routes/reports.ts]
autonomous: true
requirements: [REP-03]
must_haves:
  truths: ["Usuário baixa CSV do mês selecionado"]
  artifacts: ["src/reports/csv.ts"]
  key_links: ["rota /reports/:mes/csv → toCsv()"]
---
<objective>Exportar relatório mensal em CSV.</objective>
<context>@.planning/PROJECT.md @.planning/phases/02-relatorios/02-CONTEXT.md</context>
<tasks>
  <task type="auto">
    <name>Serializar lançamentos em CSV</name>
    <files>src/reports/csv.ts, tests/reports/csv.test.ts</files>
    <action>Separador ';', UTF-8 com BOM; escapar aspas; sem dependência nova.</action>
    <verify>npx vitest run tests/reports/csv.test.ts</verify>
    <done>Teste cobre acento, valor negativo e mês vazio; todos passam.</done>
  </task>
  <task type="checkpoint:human-verify">
    <name>Abrir o CSV no Excel e conferir acentuação</name>
  </task>
</tasks>
<verification>Suite verde; download manual funciona.</verification>
<success_criteria>REP-03 atendido.</success_criteria>
<output>02-01-SUMMARY.md</output>
```

### 3.3 Como pergunta antes de codar

- **`/gsd-new-project`**: questionamento profundo até a visão cristalizar → agentes de pesquisa → escopo de requisitos (v1/v2/fora). Filosofia de questionamento: **parceiro de pensamento, não interrogador** — deixar o usuário despejar o modelo mental, seguir o que o empolga, desafiar vagueza ("bom" significa o quê?), tornar concreto (peça um passo a passo), oferecer **2–4 interpretações concretas** via `AskUserQuestion` (com opção livre), e parar com um gate explícito ("pronto para criar o PROJECT.md?") quando souber **o quê, por quê, para quem e o que é "pronto"**. Evitar checklist mecânico e perguntas corporativas genéricas.
- **`/gsd-discuss-phase`**: identifica **áreas cinzentas** da fase e faz ~4 perguntas por área (modo *discuss*), **ou** modo *assumptions*: o agente lê o código, formula suposições **com evidência** e pede confirmação/correção (~2–4 interações vs ~15–20). Sai um `CONTEXT.md` que researcher/planner consomem sem precisar perguntar de novo.
- **`/gsd-spec-phase`**: questionamento socrático sobre entregáveis com sondas de cobertura de bordas e de proibições.

**(b) Orientação:** `STATE.md` curto lido sempre primeiro; `/clear` entre comandos grandes; executores em **contexto novo de 200k** (waves paralelas) com **commits atômicos por tarefa**; `HANDOFF.json` para pausar/retomar; `/gsd-progress` mostra onde você está sem recarregar tudo.
**Prós:** a formalização mais completa do ciclo (requisitos com IDs, decisões rastreáveis, verificação/UAT, gates humanos opcionais via `checkpoint:*`); fortíssimo contra *context rot*; docs em pt-BR; GSD 2 nasce no ecossistema pi. **Contras:** dezenas de comandos e arquivos (curva de aprendizado, risco de burocracia em tarefas pequenas — mitigado por `/gsd-quick`); consumo de tokens alto (pesquisadores/executores paralelos); **churn do projeto** (renomes, arquivamento, forks GSD Core × GSD 2); o estudo de de Macedo (2026) aponta vulnerabilidades típicas desses frameworks (drift, lock-in, estabilidade de extensões).

**Fontes:** <https://github.com/open-gsd/gsd-core> (README, `docs/USER-GUIDE.md`, `docs/COMMANDS.md`, `docs/pt-BR/workflow-discuss-mode.md`, `CHANGELOG.md`); repo arquivado <https://github.com/gsd-build/get-shit-done> (`agents/gsd-planner.md`, `get-shit-done/templates/{state,context}.md`, `get-shit-done/references/questioning.md`); <https://github.com/open-gsd/gsd-pi>; <https://getshitdone.help/dev/architecture/>.

---

## 4. HumanLayer — Advanced Context Engineering, RPI → QRSPI

### 4.1 "Advanced Context Engineering for Coding Agents" (Dex Horthy, 2025-08-29)

- **Fonte:** <https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md>
- **Ideia central — *frequent intentional compaction*:** desenhar **o workflow inteiro** em torno de gestão de contexto, mantendo a utilização em **~40–60%**. Compactar intencionalmente = parar, escrever o progresso num arquivo estruturado (objetivo final, abordagem, passos concluídos, falha/bloqueio atual) e recomeçar em sessão nova a partir dele.
- **Research → Plan → Implement (RPI):**
  - **Research:** entender o código, os arquivos relevantes, o fluxo de informação e possíveis causas/soluções.
  - **Plan:** passos exatos, arquivos a editar, como testar/verificar cada fase.
  - **Implement:** executar fase a fase, compactando o status de volta no plano.
- **Hierarquia de alavancagem:** uma linha ruim de código é uma linha ruim; uma linha ruim de plano vira centenas de linhas ruins; uma linha ruim de pesquisa vira milhares. → **Concentre a revisão humana em pesquisa e plano** (também serve de "alinhamento mental" do time).
- **Subagentes são sobre controle de contexto** (buscar/resumir sem sujar a janela principal).
- **Resultados relatados:** correções e features em codebase Rust de ~300k LOC (BAML) — ex.: ~35k LOC em ~7 h. **Limites relatados:** exige engajamento real do humano; precisa de alguém especialista no codebase (caso Parquet-Java falhou); problemas difíceis (condições de corrida, dependências profundas) continuam difíceis.

```text
thoughts/                 # separado do código, sincronizado por `humanlayer thoughts sync`
├── shared/               # time
│   ├── research/         # YYYY-MM-DD-ENG-XXXX-descricao.md
│   ├── plans/
│   ├── handoffs/<ticket>/YYYY-MM-DD_HH-MM-SS_<ticket>_descricao.md
│   ├── tickets/
│   └── prs/
├── <usuario>/            # notas pessoais
├── global/               # conhecimento entre repositórios
└── searchable/           # espelho só-leitura para busca (remover "searchable/" ao citar)
```

### 4.2 Os prompts (`humanlayer/humanlayer/.claude/commands`)

Arquivos: `research_codebase.md`, `create_plan.md`, `iterate_plan.md`, `implement_plan.md`, `validate_plan.md`, `create_handoff.md`, `resume_handoff.md`, `ralph_research/plan/impl.md`, `oneshot*.md`, `debug.md`, `commit.md`, `describe_pr.md`, variantes `_generic`/`_nt` (sem thoughts).

- **`/research_codebase` (gist):** papel de **documentarista, não crítico** — descreve o que existe, sem sugerir melhorias salvo pedido. Lê por inteiro os arquivos citados → decompõe a pergunta → dispara subagentes em paralelo (`codebase-locator`, `codebase-analyzer`, `codebase-pattern-finder`, `thoughts-locator`, `thoughts-analyzer`, opcional web) → espera todos → sintetiza com `arquivo:linha` → grava documento com frontmatter (`date`, `researcher`, `git_commit`, `branch`, `repository`, `topic`, `tags`, `status`, `last_updated`) e seções: pergunta, resumo, achados detalhados, referências de código, arquitetura, contexto histórico (de `thoughts/`), pesquisas relacionadas, **questões em aberto**. Follow-ups são anexados ao mesmo doc.
- **`/create_plan` (gist):** interativo e cético. Sem argumento, pede ticket/contexto; lê tudo por inteiro; pesquisa com subagentes; **apresenta o entendimento e só pergunta o que o código não responde**; propõe **esqueleto de fases e pede buy-in antes de detalhar**; escreve o plano; itera com o humano. Regra: **nenhuma questão em aberto no plano final**.

```markdown
<!-- thoughts/shared/plans/2026-09-23-ENG-123-export-csv.md — exemplo ilustrativo do template -->
# Export CSV — Plano de implementação
## Visão geral
## Análise do estado atual (com arquivo:linha)
## Estado final desejado (e como verificar)
## Descobertas-chave
## O que NÃO vamos fazer
## Abordagem
## Fase 1: <nome>
### Mudanças necessárias (arquivo → o que muda)
### Critérios de sucesso
#### Verificação automatizada
- [ ] `npm test` passa
- [ ] `npm run typecheck` passa
#### Verificação manual
- [ ] Baixar CSV e abrir no Excel sem problemas de acento
## Fase 2: …
## Estratégia de testes · Performance · Migração
## Referências (ticket, pesquisa, implementações parecidas)
```

- **`/implement_plan` (gist):** lê o plano inteiro e os checkboxes já marcados (confia neles ao retomar); segue a **intenção** adaptando à realidade; se o código divergir do plano, **PARA** e reporta no formato *Problema na Fase N: esperado / encontrado / por que importa / como devo seguir?*; ao fim de cada fase roda os checks automáticos, **marca checkboxes no próprio arquivo do plano** e **pausa para verificação manual humana** antes da próxima fase.
- **`/create_handoff` + `/resume_handoff`:** documento de passagem de turno com tarefas e status, 2–3 referências críticas, mudanças recentes (`arquivo:linha`), aprendizados, artefatos produzidos, próximos passos priorizados e notas; a próxima sessão roda `/resume_handoff <arquivo>`.

### 4.3 Evolução em 2026: QRSPI / "CRISPY"

- **Fonte primária:** palestra de Dex Horthy *Everything We Got Wrong About Research-Plan-Implement* — Coding Agents Conference, Computer History Museum, **2026-03-03** (<https://www.youtube.com/watch?v=YwZR6tc7qYg>); resumos em ZenML LLMOps Database e alexlavaee.me. Os prompts oficiais de QRSPI **não foram publicados** segundo implementações comunitárias (ex.: `matanshavit/qrspi`) — **não verificado diretamente**.
- **O que deu errado no RPI:**
  - **Orçamento de instruções:** modelos de fronteira seguem com consistência algo como ~150–200 instruções; o prompt de planejamento tinha ~85 e, somado ao system prompt e ferramentas, o modelo **pulava o alinhamento interativo** e ia direto ao plano em cerca de metade das vezes.
  - **"Palavras mágicas":** o fluxo só funcionava com frases específicas.
  - **Ilusão da leitura do plano:** planos de ~1.000 linhas que divergiam da implementação; revisores acabavam lendo plano **e** código. Eles admitem ter passado meses sem ler código e precisado reescrever partes grandes.
  - **Pesquisa contaminada** pela intenção de implementação.
- **Novo fluxo (8 estágios; 5 de alinhamento + 3 de execução):** **Questions** (gerar perguntas de pesquisa) → **Research** (contexto novo, **sem ver o ticket**, só fatos do código) → **Design discussion** (~200 linhas: estado atual, estado desejado, padrões, decisões, questões em aberto — principal ponto de revisão humana) → **Structure outline** (~2 páginas, "como um header file": assinaturas, tipos novos, fases, checkpoints de teste) → **Plan** (tático; o humano só faz spot-check) → **Work tree** (fatias **verticais** testáveis, não camada por camada) → **Implement** → **PR** (humano **lê o código**).
- **Princípios:** < ~40 instruções por estágio; controle de fluxo em código/orquestração, não em prompt; manter contexto **abaixo de ~40%** e recomeçar por volta de 60%.

**(a) Perguntas:** o agente pergunta **só o que o código não responde**; em QRSPI há um estágio explícito de perguntas e uma *design discussion* curta para alinhar. **(b) Orientação:** compactação intencional em arquivos (`thoughts/`), handoffs, checkboxes no plano, contexto novo por fase.
**Prós:** a abordagem mais honesta sobre custo de revisão; artefatos curtos no lugar certo; ótimo para brownfield grande. **Contras:** exige muito engajamento e expertise; o tooling público (`thoughts`, comandos) reflete o RPI de 2025; QRSPI oficial não é público.

---

## 5. Harper Reed — "My LLM codegen workflow atm"

- **Fontes:** <https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/> (2025-02-16) e a adaptação para Claude Code em <https://harper.blog/2025/05/08/basic-claude-code/> (2025-05-08). Não encontrei atualização de 2026.
- **Fluxo greenfield:** **Idea honing** (chat com modelo forte) → `spec.md` → **Planning** (modelo de raciocínio) → `prompt_plan.md` + `todo.md` → **Execution** (Claude/Aider; depois Claude Code).

Gist de cada prompt (**exemplos ilustrativos**, paráfrase minha):

```text
[1] Idea honing
Faça-me UMA pergunta por vez para construirmos juntos uma spec detalhada, passo a passo,
desta ideia. Cada pergunta deve partir das minhas respostas anteriores. Vamos iterar e
aprofundar cada detalhe relevante. Lembre: só uma pergunta por vez.
Ideia: <…>

[2] Fechamento
Compile tudo o que discutimos numa especificação completa, pronta para um desenvolvedor:
requisitos, decisões de arquitetura, tratamento de dados, estratégia de erros e plano de testes.
→ salvar como spec.md

[3] Planejamento (versão TDD)
Com base na spec, faça um blueprint detalhado; quebre em blocos iterativos pequenos; quebre
de novo até os passos ficarem do tamanho certo (seguros, mas avançando o projeto). Gere uma
série de prompts para um LLM de código implementar cada passo com TDD, progresso incremental,
teste cedo, sem saltos de complexidade; cada prompt constrói sobre o anterior e termina
"ligando" o que foi feito — nada de código órfão. Separe cada prompt em bloco próprio.
→ salvar como prompt_plan.md   (a versão não-TDD só remove a ênfase em testes)

[4] Checklist
Crie um todo.md que eu possa usar como checklist. Seja minucioso.
```

- **No Claude Code (mai/2025):** `spec.md` e `prompt_plan.md` na raiz; o prompt de execução manda abrir `prompt_plan.md`, achar o próximo prompt não concluído, implementar, rodar testes, commitar e **marcar como concluído**; depois ele só digita "continue". Guardrails: **TDD** (virou defensor — o modelo "se alimenta" de testes), **lint/format** (Ruff, Biome), **pre-commit hooks** (impedem commit de código quebrado), `CLAUDE.md` pessoal inspirado no de Jesse Vincent, comandos em `.claude/commands/`.
- **Brownfield:** empacotar o código com repomix e aplicar prompts por tarefa (code review com números de linha, testes faltando, gerar issues).
- **Ressalvas do autor:** o risco de ir rápido demais e perder o controle ("over my skis"); é um fluxo **solo** (multiplayer não resolvido); muito tempo esperando o modelo.

**(a)** Explícito e simples: uma pergunta por vez até a spec. **(b)** `prompt_plan.md`/`todo.md` com marcações persistem o estado entre chamadas; commits.
**Prós:** mínimo, portátil (funciona igual no pi, que não tem plan mode nem to-dos — Mario Zechner recomenda exatamente PLAN.md/TODO.md). **Contras:** sem gates formais, sem decisões/ADRs, sem verificação obrigatória além do que você pedir; a spec tende a congelar (sem mecanismo de atualização).

---

## 6. Context Engineering template / PRP

### 6.1 `coleam00/context-engineering-intro` (Cole Medin)

- **Fonte:** <https://github.com/coleam00/context-engineering-intro> (~13.9k stars).

```text
context-engineering-intro/
├── .claude/commands/
│   ├── generate-prp.md       # pesquisa + gera o PRP
│   └── execute-prp.md        # implementa a partir do PRP
├── PRPs/
│   ├── templates/prp_base.md
│   └── <feature>.md          # PRPs gerados
├── examples/                 # padrões de código de referência (crítico)
├── CLAUDE.md                 # regras globais
├── INITIAL.md                # pedido de feature (template)
└── INITIAL_EXAMPLE.md
```

- **Fluxo:** regras em `CLAUDE.md` → escrever `INITIAL.md` → `/generate-prp INITIAL.md` (pesquisa o codebase e docs, monta o PRP com *validation gates* e dá uma **nota de confiança 1–10** para sucesso em uma passada) → `/execute-prp PRPs/<feature>.md` (carrega contexto, planeja com to-do, implementa, valida, itera até passar).

```markdown
<!-- INITIAL.md — exemplo ilustrativo -->
## FEATURE
Export do relatório mensal em CSV (separador ';', UTF-8 com BOM), acionado pela tela de relatórios.
## EXAMPLES
examples/routes/download-pdf.ts — seguir o mesmo padrão de streaming
## DOCUMENTATION
<link da doc do Fastify sobre streams>
## OTHER CONSIDERATIONS
Meses sem lançamentos devem gerar só o cabeçalho; atenção a valores negativos.
```

```markdown
<!-- PRPs/export-csv.md — esqueleto do PRP (paráfrase do prp_base) -->
# PRP: <feature>
## Goal / Why / What
## Success Criteria (checklist mensurável)
## All Needed Context
### Documentação e referências (lista: url|file + por que ler + ponto crítico)
### Árvore atual do código  ·  Árvore desejada (arquivos novos e responsabilidade)
### Gotchas conhecidos (bibliotecas, peculiaridades do repo)
## Implementation Blueprint
### Modelos de dados
### Tarefas em ordem (CREATE/MODIFY <arquivo>, padrão a espelhar)
### Pseudocódigo por tarefa (pontos CRÍTICOS/GOTCHA)
### Pontos de integração (migrations, config, rotas)
## Validation Loop
### Nível 1: sintaxe/estilo (lint, typecheck)
### Nível 2: testes unitários (feliz, validação, bordas)
### Nível 3: integração (subir serviço + chamada real)
## Checklist final · Anti-padrões a evitar
```

### 6.2 `Wirasm/PRPs-agentic-eng` (Rasmus Widing)

- **Fonte:** <https://github.com/Wirasm/PRPs-agentic-eng> (branch `development`, ~2.2k stars).
- **Definição:** PRP = **PRD + inteligência curada do codebase + runbook do agente** — o pacote mínimo para o agente entregar código de produção na primeira tentativa.
- **Estado atual:** distribuído como plugin/skills `prp-core` (`/plugin marketplace add Wirasm/PRPs-agentic-eng` → `/plugin install prp-core@prp-marketplace`); comandos antigos em `old-prp-commands/`. Principais: `/prp-prd` (PRD interativo com fases), `/prp-plan`, `/prp-implement` (até commit/PR), `/prp-issue`, `/prp-loop` (plan → implement → review com ciclos de correção), `/prp-orchestrate` (worktrees paralelos), `/prp-review`, `/prp-debug`.
- **Atenção:** os artefatos agora ficam **fora do repositório**, em `~/.prp/<project-key>/{prds,plans,reports,reviews,state}` (override via `PRP_HOME`) — se você quer documentação versionada junto do código, precisa redirecionar isso.
- **Dimensionamento sugerido pelo projeto:** feature grande → PRD → Plan → Implement; média → direto Plan → Implement.

**(a) Perguntas:** fraco no template de Cole Medin (o humano escreve o `INITIAL.md`; o gerador **pesquisa**, não entrevista) — convém acrescentar uma etapa de entrevista antes; o `/prp-prd` de Widing é interativo. **(b) Orientação:** o PRP é autocontido (a sessão de execução não precisa do histórico) + validação em níveis.
**Prós:** ênfase exemplar em **contexto curado** (exemplos, docs, gotchas) e **validação executável em camadas**. **Contras:** PRPs longos (custo de revisão); "sucesso em uma passada" incentiva front-loading pesado; nota de confiança é autoavaliação do modelo.

---

## 7. AGENTS.md (padrão aberto) + carregamento no pi e no Claude Code

### 7.1 O padrão

- **Fonte:** <https://agents.md/>. É um "README para agentes": Markdown comum, **sem campos obrigatórios**. Seções típicas: visão geral, comandos de build/teste, estilo de código, instruções de teste, segurança, convenções de commit/PR.
- **Aninhamento (monorepo):** `AGENTS.md` em subpacotes; **o mais próximo do arquivo editado vence**; o prompt explícito do usuário prevalece sobre tudo. Agentes tentam **rodar os comandos de teste listados** e corrigir falhas antes de concluir.
- **Migração:** renomear o arquivo antigo e criar symlink de compatibilidade (ex.: `CLAUDE.md` → `AGENTS.md`) — **mas veja a ressalva de Windows abaixo**.
- **Governança/adoção:** a OpenAI doou o AGENTS.md à **Agentic AI Foundation (AAIF)**, sob a Linux Foundation, criada em **dez/2025** junto com MCP (Anthropic) e goose (Block); o site cita **> 60 mil projetos open source**; a AAIF passou de 170 membros em abr/2026. Suporte em Codex, Jules, Cursor, VS Code/Copilot, Gemini CLI, Aider, pi, Claude Code (nativo, ver abaixo) etc.
- **Thoughtworks Radar:** AGENTS.md apareceu em **Trial** numa edição anterior (não está na atual); no Vol. 34 (abr/2026) o tema foi absorvido por **"Curated shared instructions for software teams" — Adopt** (colocar `CLAUDE.md`/`AGENTS.md` nos templates de serviço e ancorar agentes numa *reference application*) e por **"Agent instruction bloat" — Caution** (ver §10).

### 7.2 Como o Claude Code trata AGENTS.md (docs 2026)

- **Leitura nativa a partir do Claude Code v2.1.277:** por padrão lê `AGENTS.md` **apenas se não houver** `CLAUDE.md`, `.claude/CLAUDE.md` ou `CLAUDE.local.md` no cwd ou acima (os de usuário/managed e `.claude/rules/` não contam). Carrega todo `AGENTS.md` e `.claude/AGENTS.md` do cwd para cima na partida, e o de subdiretório quando lê arquivos ali. **Não lê** `AGENTS.local.md`, `AGENTS.override.md` nem nada em `.agents/`.
- Setting **Project instructions** (via `/config` ou `pluginConfigs` do plugin embutido `agents-md@builtin` em settings de usuário/managed): `claude-md-or-agents-md` (padrão), `claude-md-and-agents-md` (ambos, CLAUDE.md primeiro), `claude-md`, `managed-only`.
- Indisponível em algumas sessões (ex.: Bedrock, telemetria desligada, primeira sessão após upgrade) → nesses casos use um `CLAUDE.md` com `@AGENTS.md`.
- **Windows:** prefira o **import `@AGENTS.md`** ao symlink — criar symlink exige admin/Developer Mode e o git pode materializar o symlink como arquivo de texto de uma linha se `core.symlinks` não estiver ativo. `/import` (≥ v2.1.213) copia a configuração de outros agentes para o Claude Code.

```markdown
<!-- CLAUDE.md que reaproveita o AGENTS.md — exemplo ilustrativo -->
@AGENTS.md

## Só para o Claude Code
- Para features novas, use plan mode e a skill /interview antes de editar código.
```

### 7.3 Como o pi carrega contexto (pi coding agent)

- **Estado do projeto:** pi é mantido pela **Earendil Inc.** (repo <https://github.com/earendil-works/pi>, antes `badlogic/pi-mono`; pacote npm `@earendil-works/pi-coding-agent`, antes `@mariozechner/pi-coding-agent`). Release mais recente vista: **v0.87.1 (22/set; ano inferido 2026 — a página não exibia o ano)**.
- **Context files:** `AGENTS.md` (ou `CLAUDE.md`) carregados do **diretório do agente (global, `~/.pi/agent/`)**, dos **diretórios pais** e do **cwd**, concatenados; `AGENTS.override.md` substitui `AGENTS.md`/`CLAUDE.md` **no mesmo diretório**; `--no-context-files` / `-nc` desliga. **Não verificado:** qual vence se `AGENTS.md` e `CLAUDE.md` coexistem no mesmo diretório; se o pi processa `@imports` (a doc não menciona — assuma que **não**); e se carrega `AGENTS.md` aninhado **abaixo** do cwd (existe o pacote comunitário `pi-nested-agents-md` para isso, o que sugere que não é nativo).
- **System prompt:** `SYSTEM.md` substitui o prompt padrão; `APPEND_SYSTEM.md` acrescenta — em `.pi/` (projeto, precede) ou no diretório do agente.
- **Skills (padrão Agent Skills):** `.agents/skills/` (cwd até a raiz do git), `~/.agents/skills/`, `~/.pi/agent/skills/`, `.pi/skills/`, e pacotes; *progressive disclosure* (só nome+descrição no prompt; conteúdo carrega quando relevante); invocação automática ou `/skill:nome`; `disable-model-invocation: true` para só manual. (O Claude Code usa `.claude/skills/` e também segue o padrão agentskills.io, mas **não** lê `.agents/skills/` segundo a doc.)
- **Prompt templates:** `.pi/prompts/*.md` e `~/.pi/agent/prompts/` → `/nome-do-arquivo`, com `$1`, `$2`, `$@`/`$ARGUMENTS`, `${1:-default}`; `/reload` após editar.
- **Extensões:** `.pi/extensions/` (TypeScript) com eventos como `session_start`, `before_agent_start`, `tool_call` (pode alterar/bloquear chamadas — formato exato do bloqueio **não verificado**), `context`, `turn_end`; `pi.registerTool`/`registerCommand`. Pacotes: `pi install npm:<pkg>` / `git:<repo>`.
- **Sessões:** árvore em JSONL; `/tree` (alternativas no mesmo arquivo), `/fork` (nova sessão a partir de mensagem anterior), `/clone`, `/compact [instruções]`, `/new`, `--continue`, `--resume`.
- **Filosofia (Mario Zechner, <https://mariozechner.at/posts/2025-11-30-pi-coding-agent/>, 2025-11-30):** sem plan mode, sem to-dos embutidos, sem subagentes, sem MCP. Em vez disso: **escreva o plano num arquivo** (`PLAN.md` com objetivo, abordagem, passos e progresso) e colabore nele; use **`TODO.md` com checkboxes** (to-do lists embutidas mais confundem que ajudam o modelo, segundo ele); faça a **coleta de contexto numa sessão própria que gera um artefato** usado depois numa sessão nova (em vez de subagentes opacos); total observabilidade do que entra no contexto. Ou seja: **o pi já pressupõe um fluxo document-first** — só não o impõe.
- **Perguntas estruturadas no pi:** não há `AskUserQuestion` nativo; há extensões comunitárias inspiradas nele (`pi-interview`, `pi-ask-user`, `@juicesharp/rpiv-ask-user-question`, `@nguyenquangthai/pi-ask`) — **não auditadas**. Sem elas, o padrão "uma pergunta por mensagem" funciona só com prompt.
- Pacotes de plano/handoff no catálogo (ex.: `@hank-warren/pi-plan-mode` com arquivos de plano duráveis, `@alexeiled/pi-plan-exec`, `pi-handoff`, `@juicesharp/rpiv-pi` com skills discover→research→design→plan→implement→validate) — **não auditados**.

### 7.4 Evidência sobre arquivos de contexto

- **Gloaguen et al. (ETH Zurich / LogicStar), "Evaluating AGENTS.md…", arXiv 2602.11988** (v1 2026-02-12, v2 2026-06-23): arquivos de contexto **não melhoram** a taxa de resolução em geral e **aumentam o custo em > 20%** (mais passos, mais tokens de raciocínio). Na análise da v1 (resumo DAIR.AI): arquivos escritos por desenvolvedores deram ~+4%; gerados por LLM, −0,5% a −2%. Instruções são bem seguidas, mas **visões gerais do repositório não ajudam**; arquivos são úteis para **práticas não padronizadas** (ferramentas, convenções não óbvias). Recomendação: conteúdo mínimo, só o que falta no repo; avaliar antes de "melhorar".

```markdown
<!-- AGENTS.md — exemplo ilustrativo, enxuto, orientado a documentation-first -->
# AGENTS.md
## Regras de processo (obrigatórias)
- NÃO edite código de produção sem uma spec com `status: approved` em docs/specs/.
- Feature nova ou mudança em > 2 arquivos: primeiro entreviste o usuário (uma pergunta por vez),
  registre respostas em docs/specs/<data>-<tema>.md e as dúvidas em docs/OPEN-QUESTIONS.md.
- Início de sessão: leia docs/STATE.md, rode `git log --oneline -15`, pegue só a próxima tarefa
  não marcada do plano apontado no STATE.md.
- Fim de tarefa: rode os testes, mostre a saída, marque o checkbox no plano, atualize STATE.md, commit.
- Decisão arquitetural nova → ADR em docs/decisions/ (MADR). Divergência entre spec e código → pare e pergunte.
## Comandos
- Testes: `pnpm test` · Um arquivo: `pnpm vitest run <path>` · Tipos: `pnpm typecheck`
## Peculiaridades do projeto (só o que não dá para inferir do código)
- Datas sempre em America/Sao_Paulo; valores monetários em centavos (inteiros).
```

---

## 8. Cline Memory Bank

- **Fonte:** <https://docs.cline.bot/prompting/cline-memory-bank> (página sem data visível). Instruções customizadas ficam em Cline Rules (ex.: `.clinerules/memory-bank.md`) ou globais.
- **Premissa:** a memória do agente zera entre sessões; o Memory Bank é o **único elo** com o trabalho anterior → a instrução manda **ler TODOS os arquivos do memory bank no início de TODA tarefa**.

```text
memory-bank/
├── projectbrief.md     # fundação: requisitos centrais e objetivos (molda todos os outros)
├── productContext.md   # por que existe, problemas que resolve, como deve funcionar, metas de UX
├── systemPatterns.md   # arquitetura, decisões técnicas, padrões, relação entre componentes
├── techContext.md      # stack, setup, restrições, dependências
├── activeContext.md    # foco atual, mudanças recentes, próximos passos, decisões ativas (muda mais)
├── progress.md         # o que funciona, o que falta, status, problemas conhecidos
└── (opcional) features/, api/, testing/, deployment/ …
Hierarquia: projectbrief → {productContext, systemPatterns, techContext} → activeContext → progress
```

- **Fluxos:** *Plan mode* (ler o memory bank → se incompleto, criar plano/perguntar; se completo, verificar contexto → estratégia → apresentar abordagem) e *Act mode* (checar memory bank → atualizar docs → executar → documentar mudanças).
- **Quando atualizar:** ao descobrir padrões novos; após mudanças significativas; quando o contexto precisar de clarificação; e quando o usuário diz **"update memory bank"** — aí revisar **todos** os arquivos (mesmo os que não mudaram), com foco em `activeContext.md` e `progress.md`.
- **Comandos-gatilho:** "initialize memory bank", "update memory bank", "follow your custom instructions" (retomar).
- **Janela cheia:** pedir "update memory bank" → nova conversa → "follow your custom instructions".
- **Evoluções do Cline (2025+):** `/deep-planning` (investigação silenciosa do código → perguntas direcionadas → `implementation_plan.md` → **nova task** limpa para executar); **Focus Chain** (to-do list persistente que atravessa resets e é relida/atualizada periodicamente — a cada ~6 mensagens, segundo o Cline); `/newtask` (handoff que empacota plano, decisões, arquivos e próximos passos); Auto Compact.

```markdown
<!-- memory-bank/activeContext.md — exemplo ilustrativo -->
# Contexto ativo (atualizado 2026-09-23)
## Foco atual: export CSV (spec docs/specs/2026-09-23-export-csv.md, aprovada)
## Mudanças recentes: serializador pronto (commit a1b2c3d)
## Próximos passos: endpoint de download; teste E2E
## Decisões ativas: separador ';' e BOM UTF-8 (ADR-0004)
## Dúvidas abertas: Q-03 (limite de linhas?)
```

**(a)** Plan mode + "se incompleto, pergunte"; `/deep-planning` pergunta antes do plano. **(b)** O próprio memory bank (+ Focus Chain / handoffs).
**Prós:** simples, agnóstico de ferramenta (dá para usar igual no pi e no Claude Code com uma regra no `AGENTS.md`); separa bem "por que/o quê" (estável) de "agora" (volátil). **Contras:** "ler tudo sempre" custa contexto e contraria o *just-in-time*; tende a inchar e desatualizar (depende de disciplina); não tem gates, requisitos com ID nem verificação; a evidência sobre arquivos de contexto longos (§7.4, §10) pede cautela — mantenha os arquivos estáveis curtos e leia os voláteis primeiro.

---

## 9. Formatos de apoio

### 9.1 ADR / MADR (decisões)

- **ADR** = registro de uma decisão arquitetural e sua justificativa; o conjunto de ADRs de um projeto é o seu **decision log** (<https://adr.github.io/>). Modelos: **Nygard (2011)** — Título, Status, Contexto, Decisão, Consequências; **Y-statements**; **MADR**. Ferramentas: `adr-tools`, `log4brains`.
- **MADR 4.0.0 (2024-09-17)** — <https://adr.github.io/madr/>: variantes *full*, *minimal* e *bare*; arquivos em `docs/decisions/NNNN-titulo-com-hifens.md`; status `proposed | rejected | accepted | deprecated | superseded by ADR-NNNN`.

```markdown
<!-- docs/decisions/0004-separador-csv.md — exemplo ilustrativo no formato MADR -->
---
status: accepted
date: 2026-09-23
decision-makers: <você>
---
# Usar ';' como separador e UTF-8 com BOM no CSV
## Contexto e problema
Usuários abrem o arquivo no Excel pt-BR; vírgula é separador decimal.
## Fatores de decisão
- Abrir corretamente no Excel pt-BR · Acentuação correta
## Opções consideradas
1. ',' sem BOM  2. ';' com BOM  3. Gerar XLSX
## Resultado
Opção 2, porque abre direto no Excel pt-BR sem configuração.
### Consequências
- Bom: zero passos manuais. Ruim: ferramentas que esperam ',' precisam de parâmetro.
### Confirmação
Teste automatizado verifica BOM e separador; checagem manual no Excel (UAT).
## Prós e contras das opções (opcional) · Mais informações (links para spec/issue)
```

- **Uso com agentes:** o agente cria ADR quando uma decisão da entrevista/plano é arquitetural; a spec referencia o ADR; o `AGENTS.md` manda consultar `docs/decisions/` antes de mudar algo decidido. Variantes leves: `DECISIONS.md` único (o GSD 2 usa `.gsd/DECISIONS.md`) ou decisões numeradas `D-01…` no `STATE.md` (GSD Core, onde os planos precisam referenciar cada decisão).

### 9.2 EARS (requisitos)

- **Easy Approach to Requirements Syntax** — Alistair Mavin e colegas (Rolls-Royce), IEEE RE'09 (2009). Adotado por Airbus, Bosch, NASA, Siemens etc.; o **Kiro** (AWS, 2025) usa EARS nos critérios de aceite. Fonte: <https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax>.

```text
# Os 5 padrões — exemplos ilustrativos (keywords em inglês, conteúdo em PT)
Ubiquitous:        THE sistema SHALL armazenar valores monetários em centavos.
Event-driven:      WHEN o usuário clicar em "Exportar CSV", THE sistema SHALL gerar o arquivo do mês selecionado.
State-driven:      WHILE uma exportação estiver em andamento, THE sistema SHALL desabilitar o botão de exportar.
Optional feature:  WHERE o plano Pro estiver ativo, THE sistema SHALL permitir exportar 12 meses de uma vez.
Unwanted behavior: IF o mês não tiver lançamentos, THEN THE sistema SHALL gerar apenas o cabeçalho.
Complexo:          WHILE offline, WHEN o usuário pedir exportação, THE sistema SHALL enfileirar o pedido.
```

- **Por que ajuda com LLMs:** cada requisito vira uma frase testável (gatilho → resposta), fácil de mapear para teste e de revisar; reduz ambiguidade que o agente "preencheria" sozinho. Não precisa ser dogmático: use EARS para critérios de aceite, prosa para contexto.

### 9.3 Log de questões em aberto (open questions)

Não há padrão formal; os frameworks convergem em: **nenhuma questão bloqueante aberta ao aprovar a spec/plano** (HumanLayer: sem questões em aberto no plano final; Superpowers: *ambiguity check* no self-review; GSD: "Claude's Discretion" + "Deferred Ideas"; QRSPI: questões abertas na *design discussion*).

```markdown
<!-- docs/OPEN-QUESTIONS.md — exemplo ilustrativo -->
| ID   | Pergunta                               | Contexto/impacto          | Opções (recomendação ★) | Dono | Status    | Resolução / link        |
|------|----------------------------------------|---------------------------|--------------------------|------|-----------|-------------------------|
| Q-01 | Limite de linhas por export?           | Performance do endpoint   | 10k / 50k★ / sem limite  | Você | resolvida | ADR-0005                |
| Q-02 | Incluir lançamentos estornados?        | Muda totalizadores        | sim / não★               | Você | aberta 🔴 | bloqueia R-04           |
| Q-03 | Nome do arquivo com mês por extenso?   | Cosmético                 | a critério do agente     | —    | delegada  | "Discretion" na spec    |
```

Regra sugerida: 🔴 (bloqueante) impede `status: approved`; perguntas não bloqueantes podem ser "delegadas ao agente" explicitamente.

### 9.4 llms.txt

- Proposto por Jeremy Howard (set/2024); **v2 publicada em 2026-08-10** com aprendizados de dois anos de adoção (<https://llmstxt.org/>). Arquivo `/llms.txt` com: H1 com o nome, blockquote com resumo, parágrafos opcionais, seções H2 com listas de links Markdown para páginas `.md` limpas, e uma seção "Optional" para o secundário. Adotado por plataformas de docs (ex.: Mintlify gera automaticamente; a doc do Claude Code expõe `code.claude.com/docs/llms.txt`), auditado pelo Lighthouse (segundo o site).
- **Uso no seu fluxo:** fonte *just-in-time* para docs de bibliotecas externas (linkar no `AGENTS.md` ou na spec em vez de colar documentação). Não substitui `AGENTS.md` (que é sobre o **seu** repo).

### 9.5 Outros padrões que valem citar

- **Matt Pocock — `mattpocock/skills`** (~268k stars; `npx skills@latest add mattpocock/skills`): `grill-me` entrevista implacavelmente sobre um plano, tratando as decisões como **árvore**: em cada rodada pergunta toda a "fronteira" (decisões cujos pré-requisitos já estão resolvidos), **numeradas e cada uma com resposta recomendada**, e espera as respostas antes da próxima rodada — contraponto útil ao "uma pergunta por vez" (menos idas e vindas); `grill-with-docs` atualiza `CONTEXT.md` e ADRs durante a entrevista; `to-spec`, `to-tickets`, `implement`, `tdd`, `handoff`. Por seguir o padrão Agent Skills, serve para pi e Claude Code.
- **martinfowler.com, Rahul Garg (2026-04-08), "Patterns for Reducing Friction in AI-Assisted Development":** *Knowledge Priming* (contexto curado com versões, estrutura, convenções, exemplos), *Design-First Collaboration* (capacidades → componentes → interações → contratos → só então implementação), **Context Anchoring** (documento vivo com decisões, restrições e estado atual da feature, que atravessa sessões), *Encoding Team Standards*, *Feedback Flywheel*.
- **SPDD — Structured-Prompt-Driven Development** (Wei Zhang e Jessie Jie Xia, martinfowler.com, 2026-04-28): prompts estruturados como artefato versionado (o *REASONS Canvas*: requisitos/DoD, entidades, abordagem, estrutura, operações, normas, salvaguardas); regra: quando a realidade diverge, **corrija o prompt/spec primeiro e depois o código**; recomendado para entrega padronizada/regulada; ruim para hotfix, spikes e scripts.

---

## 10. Críticas e evidências

### 10.1 Birgitta Böckeler — "Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl" (martinfowler.com, 2025-10-15)

- **Fonte:** <https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html>
- **Três níveis de SDD:** *spec-first* (spec bem pensada antes, usada na tarefa e depois descartada), *spec-anchored* (a spec permanece e guia a evolução da feature), *spec-as-source* (a spec é o artefato principal; humano não edita o código gerado — Tessl marca arquivos como gerados).
- **Observações:** Kiro (requirements → design → tasks, user stories + critérios GIVEN/WHEN/THEN) foi "marreta para quebrar noz" num bug pequeno; spec-kit gerou muitos arquivos Markdown repetitivos e verbosos — ela preferiria revisar código a revisar tanto Markdown; Tessl mostrou não determinismo ao regenerar do mesmo spec.
- **Críticas:** um workflow único para todos os tamanhos de problema; **falsa sensação de controle** (o agente ignora instruções ou as segue com zelo excessivo, ex.: duplicando código); separação confusa entre spec funcional e técnica; público-alvo indefinido; paralelo com **Model-Driven Development**, que falhou por inflexibilidade **e** não determinismo; termo sofrendo difusão semântica. Conclusão: *spec-first* vale a pena; o resto ainda é duvidoso (pode ser um "piorar tentando melhorar").

### 10.2 Thoughtworks Technology Radar

- **Vol. 33 (nov/2025):** *Spec-driven development* em **Assess** — interessante, mas workflows elaborados e opinativos; specs longas difíceis de revisar; público dos artefatos incerto; risco de reforçar antipadrões de especificação pesada up-front (tipo waterfall); lembrança de que regras artesanais detalhadas para IA não escalam. (<https://www.thoughtworks.com/radar/techniques/spec-driven-development>)
- **Vol. 34 (abr/2026):** a técnica SDD **saiu** e entraram ferramentas em **Assess**: **GitHub Spec Kit** (ressalvas: instruções que crescem e envelhecem, verbosidade que aumenta carga cognitiva, excesso de arquivos; quem mais extrai valor são engenheiros experientes) e **OpenSpec** (fluxo mínimo propose → apply → archive com *deltas* de spec, bom para brownfield; reavaliar se ferramenta SDD dedicada continua necessária com modelos melhores). Também: **Context engineering → Adopt**; **Curated shared instructions → Adopt**; **Agent Skills → Trial**; **Progressive context disclosure → Trial**; **Feedback sensors for coding agents → Trial**; **Agent instruction bloat → Caution** (instruções acumulam, conflitam e o modelo presta menos atenção ao meio de contextos longos — seja intencional, adicione só quando necessário, use divulgação progressiva); **Codebase cognitive debt → Caution**; **Claude Code → Adopt** (com disciplina de revisão e context engineering). *(O rótulo exibido é "Caution"; entendo como o antigo anel "Hold" — interpretação minha.)*

### 10.3 Outras críticas notáveis

- **Marmelab, François Zaninotto — "Spec-Driven Development: The Waterfall Strikes Back" (2025-11-12):** SDD lembra waterfall (documentação maciça antes do código); agentes descobrem contexto por busca textual e **perdem funções existentes**; "loucura de Markdown" (prosa verbosa escondendo erros básicos); burocracia sistemática (cenários imaginários, refinamentos exagerados); "falso ágil"; **revisão dupla** (spec técnica + código, porque ainda haverá bugs); falsa segurança (agentes nem sempre seguem a spec); retornos decrescentes à medida que o app cresce. Alternativa: iterar em passos pequenos, quebrando requisitos complexos em simples. (<https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html>)
- **Kent Beck, citado por Martin Fowler (fragmento de 2026-01-08):** as descrições de SDD que ele viu pressupõem escrever a spec inteira antes, como se **nada fosse aprendido durante a implementação** — o que ele acha bizarro; Fowler reforça que o ciclo de aprendizado por experimentação é essencial. (<https://martinfowler.com/fragments/2026-01-08.html>)
- **Autocrítica da HumanLayer (2026-03-03):** planos longos não são lidos; ler o código é inegociável; alinhe em artefatos curtos (§4.3).
- **Böckeler — "Harness engineering for coding agent users" (2026-04-02):** o harness combina **guias** (feedforward: `AGENTS.md`, specs, skills, apps de referência) e **sensores** (feedback: testes, linters, type checkers, revisões por IA), computacionais (rápidos, determinísticos) e inferenciais (lentos, não determinísticos); mova a qualidade "para a esquerda"; o humano é um harness implícito — direcione o input humano para onde ele mais importa; quando um problema se repete, melhore os guias/sensores. Specs são só um tipo de guia; sem sensores, não há confiança. (<https://martinfowler.com/articles/harness-engineering.html>)

### 10.4 Evidência empírica (2026)

- **Arquivos de contexto:** ver §7.4 (ETH Zurich: sem ganho geral, +20% de custo; humanos > LLM-gerados; útil para práticas não padrão).
- **Farrag, "The Productivity-Reliability Paradox…", arXiv 2605.01160 (2026-05-01)** + resumo na **InfoQ, "When Spec-Driven Development Pays Off" (Nitin Garg, 2026-09-10)**: o paradoxo — estudos de laboratório com +20–56% de produtividade, mas RCT com **−19%** para desenvolvedores experientes e telemetria com **+98% de PRs e +91% de tempo de revisão** sem ganho de entrega. No piloto: disciplina de spec deu **~+21 pontos** a modelos mais fracos e **~+2** aos fortes; revisão ancorada em spec levou **~48 min vs ~27 min**; a spec **não aumentou a detecção de bugs** (recall ~0,52 nos dois), mas tornou os achados **atribuíveis a requisitos** (81% vs 0%). Recomenda governança de spec **só onde o risco justifica** (regulado, multi-restrição, longa vida) e pular para protótipos, scripts e tarefas que o assistente já resolve em uma passada. *(Números via resumo da InfoQ; paper lido só no abstract.)*
- **de Macedo, "From Prompt to Process…", arXiv 2606.04967 (2026-06-03):** compara Spec Kit, OpenSpec, BMAD, GSD, Spec Kitty e Reversa numa taxonomia de 6 dimensões (especificação, contexto, papéis, execução, validação, portabilidade). Nenhum cobre bem as 6 — há *trade-off* entre **profundidade de processo e portabilidade entre agentes**. Vulnerabilidades recorrentes: **drift spec–código**, dependência excessiva de saídas geradas, extensões comunitárias instáveis, lock-in de plataforma, **ausência de benchmarks de processo**.
- **A própria Anthropic:** pule o plano quando o diff cabe numa frase; "procure a solução mais simples"; cada peça do harness é uma aposta sobre limitações do modelo e deve ser removida quando o modelo melhora (§1.4).

### 10.5 Visão equilibrada

- **Consenso:** *spec-first leve* e **alinhamento antes de codar** valem a pena; o que é contestado é **SDD pesado e uniforme** (muitos artefatos, specs longas, spec-as-source).
- **Onde o valor aparece:** requisitos ambíguos, trabalho multi-sessão, brownfield com armadilhas, domínios regulados/alto risco, times (alinhamento mental), modelos menos capazes.
- **Onde vira desperdício:** bugfix trivial, spikes, protótipos, tarefas que o modelo acerta de primeira; specs que ninguém lê; specs que não são atualizadas (drift) — nesses casos a spec vira **passivo**.
- **Mitigações práticas:** artefatos **curtos** (design de ~1–2 páginas, não planos de 1.000 linhas); revisar **cedo** (entendimento/design) e **ler o código** no fim; **sensores** executáveis (TDD/E2E) como verdade, não a prosa; spec **viva** (atualizar ao aprender — "conserte a spec primeiro"); detecção de drift (ex.: revisor comparando diff × spec; IDs de requisito ↔ testes); podar `AGENTS.md`/`CLAUDE.md` regularmente.

#### Matriz de dimensionamento (sugestão baseada nas fontes)

| Tamanho do problema | Sinais | Processo | Artefatos |
|---|---|---|---|
| **Trivial** | diff descritível numa frase; < 30 min | Pedir direto + teste + commit | Nenhum (talvez 1 linha no STATE) |
| **Pequeno ("bounded")** | 1–3 arquivos; sem decisão arquitetural | 3–5 perguntas → mini-design **no chat** → aprovação → TDD | Nota no STATE/commit; nada de spec em arquivo |
| **Feature média** | vários arquivos; 1–3 dias; alguma ambiguidade | Entrevista → `SPEC.md` curta (≤ 2 páginas) → plano com tarefas checkbox → **sessão nova** implementa → revisão (subagente + humano) | spec, plano, ADR se houver decisão, STATE |
| **Projeto novo / subsistema** | vários subsistemas; semanas; múltiplas sessões | Visão/requisitos (IDs, v1/v2/fora) → roadmap em fases → por fase: discuss → design curto → plano → executar em contexto novo → verificar/UAT | PROJECT/REQUIREMENTS/ROADMAP/STATE, CONTEXT/PLAN/SUMMARY por fase, ADRs, handoffs |
| **Crítico / regulado / longa vida** | compliance, dinheiro, segurança, auditoria | Tudo acima + *spec-anchored* com rastreabilidade (requisito ↔ teste), gates de revisão e checagem de drift | + matriz de rastreabilidade, EARS, registro de aprovação |

**Suba de nível quando:** aparecer complexidade escondida (a regra de "upgrade" do Superpowers), mais de um subsistema, decisão difícil de reverter (schema, API pública), ou o trabalho atravessar sessões. **Desça de nível quando:** você parar de ler os artefatos, a spec ficar maior que o código, ou o tempo de revisão superar o tempo economizado.

---

## 11. Síntese: padrões recorrentes — checklist prático

> Cada item cita onde o padrão aparece. Use como checklist de configuração (uma vez) e de execução (por feature).

### A. Fundação (uma vez por repositório)
- [ ] **Arquivo de contexto persistente, curto e escrito por humano** (`AGENTS.md`; `CLAUDE.md` com `@AGENTS.md` para o Claude Code — no Windows, import em vez de symlink). Só o que o agente não infere: comandos, convenções não óbvias, regras de processo. Alvo < 100–200 linhas. *(Anthropic, AGENTS.md, ETH 2026, Thoughtworks "instruction bloat")*
- [ ] **Regras de processo explícitas** no arquivo de contexto: "sem código sem spec aprovada", rotina de início/fim de sessão, onde ficam spec/plano/estado/decisões. *(Superpowers hard gate, GSD, Cline)*
- [ ] **Divulgação progressiva:** detalhes em `docs/` linkados, `.claude/rules/` com `paths:`, skills — não tudo no arquivo principal. *(Anthropic just-in-time, Thoughtworks)*
- [ ] **Sensores executáveis prontos**: comando de testes, typecheck, lint, E2E; `init.sh`/script que sobe o ambiente. *(Anthropic harness, Böckeler)*
- [ ] **Gates determinísticos onde importa** (hooks no Claude Code; extensões no pi): ex.: bloquear edição de `src/` sem spec aprovada; injetar `STATE.md` no início da sessão; impedir "concluir" sem testes verdes. *(Anthropic hooks/Stop hook, pi-superpowers-plus)*

### B. Clarificação (antes de qualquer código)
- [ ] **Classificar o tamanho** (trivial / bounded / feature / projeto / crítico) e escolher o processo pela matriz. *(Superpowers spike/bounded/architectural, Anthropic "pule o plano", Böckeler)*
- [ ] **Explorar o código antes de perguntar** e só perguntar o que o código não responde. *(HumanLayer create_plan, Superpowers, GSD assumptions mode)*
- [ ] **Entrevista estruturada:** uma pergunta por vez (Superpowers, Harper Reed) **ou** rodadas pela "fronteira" com resposta recomendada (grill-me); preferir múltipla escolha com opção livre; cavar bordas, erros, tradeoffs, não o óbvio. *(Anthropic AskUserQuestion, GSD questioning)*
- [ ] **Espelhar o entendimento** ("o que entendi é…") e pedir correção antes de desenhar. *(Superpowers v6.4, GSD)*
- [ ] **Propor 2–3 abordagens com tradeoffs** e uma recomendação. *(Superpowers)*
- [ ] **Registrar questões em aberto** num log; bloqueantes impedem aprovação; o que for "a critério do agente" fica explícito. *(HumanLayer, GSD Discretion/Deferred, QRSPI)*

### C. Spec como fonte da verdade (curta!)
- [ ] Spec **autocontida**: objetivo, escopo **e fora de escopo**, requisitos com ID (EARS para critérios de aceite), interfaces/arquivos, decisões, casos de borda, **verificação end-to-end**. *(Anthropic SPEC.md, GSD REQUIREMENTS, EARS)*
- [ ] **Tamanho de design discussion (~1–2 páginas)**, não plano de 1.000 linhas; revisar aqui é onde a alavancagem é maior. *(HumanLayer QRSPI, hierarquia de alavancagem)*
- [ ] **Self-review da spec** (placeholders, contradições, ambiguidade, escopo) e **aprovação humana explícita** registrada (`status: approved`, data). *(Superpowers)*
- [ ] **Decisões arquiteturais viram ADR** (MADR) e a spec aponta para elas. *(ADR/MADR, GSD D-01, mattpocock grill-with-docs)*

### D. Plano
- [ ] **Mapa de arquivos antes das tarefas**; tarefas **pequenas e verificáveis** (2–5 min no Superpowers; 2–3 tarefas por plano no GSD), cada uma com arquivos, interface, **comando de verificação** e critério de "feito", **com checkbox**. *(Superpowers, GSD XML, HumanLayer)*
- [ ] **Fatias verticais** testáveis em vez de camadas horizontais. *(QRSPI)*
- [ ] **Critérios de sucesso separados em automatizados e manuais**; checkpoints humanos onde for preciso. *(HumanLayer, GSD checkpoint:human-verify)*
- [ ] **Sem questões abertas no plano final**; plano referencia a spec e cada requisito/decisão. *(HumanLayer, GSD coverage gate)*

### E. Execução
- [ ] **Contexto novo por fase** (spec numa sessão, implementação em outra; executor novo por plano/tarefa se couber no orçamento). *(Anthropic, GSD, Superpowers, HumanLayer, Cline /newtask)*
- [ ] **Rotina de início de sessão:** ler estado → `git log` → próxima tarefa não marcada → rodar ambiente + teste básico (pegar regressão antes de trabalho novo). *(Anthropic harness)*
- [ ] **Uma tarefa/feature por vez**; commit atômico com mensagem descritiva ao fim de cada uma. *(Anthropic, GSD, Harper Reed)*
- [ ] **TDD** (teste falhando primeiro, ver falhar pelo motivo certo). *(Superpowers Iron Law, Harper Reed, GSD type tdd)*
- [ ] **Evidência antes de afirmar** (mostrar comando + saída). *(Superpowers verification, Anthropic)*
- [ ] **Divergência spec × realidade → parar e perguntar** (esperado / encontrado / impacto / como seguir); corrigir a spec antes do código. *(HumanLayer implement_plan, SPDD)*
- [ ] **Manter a janela abaixo de ~40–60%**; compactar **intencionalmente** para arquivo em vez de depender de auto-compact; `/clear` após duas correções falhas. *(HumanLayer, Anthropic)*

### F. Memória e retomada
- [ ] **Arquivo de estado curto** (< 100 linhas): onde estamos, spec/plano ativos, próxima ação, bloqueios, decisões recentes; atualizado ao fim de cada tarefa. *(GSD STATE.md, claude-progress.txt, Cline activeContext/progress)*
- [ ] **Checkboxes no próprio plano** como progresso durável (e/ou lista JSON "só muda `passes`" para trabalhos muito longos). *(HumanLayer, Anthropic harness, Harper Reed)*
- [ ] **Handoff escrito** ao pausar (tarefas/status, referências críticas, mudanças `arquivo:linha`, aprendizados, próximos passos). *(HumanLayer, GSD HANDOFF.json, Cline /newtask)*
- [ ] **Git como memória** (log legível, commits por tarefa, branch/worktree por feature). *(todos)*

### G. Verificação e revisão
- [ ] **Revisor separado** (subagente/sessão nova) comparando diff × spec/plano, pedindo só gaps de correção/requisitos. *(Anthropic, Superpowers, harness 3 agentes)*
- [ ] **Humano lê o código no fim** (a spec não substitui). *(HumanLayer 2026, Marmelab)*
- [ ] **UAT/checagem manual** para o que sensores não cobrem (UI, planilhas, etc.). *(GSD verify-work)*

### H. Manutenção
- [ ] **Podar** `AGENTS.md`/`CLAUDE.md`/memory bank periodicamente; converter regras que sempre falham em hooks. *(Anthropic, Thoughtworks)*
- [ ] **Checar drift** spec × código ao fechar cada feature (atualizar spec/ADR ou arquivar a spec como histórica). *(de Macedo 2026, InfoQ 2026, SPDD)*
- [ ] **Reavaliar o processo a cada modelo novo** — remover andaimes que deixaram de ser necessários. *(Anthropic harness 2026, Thoughtworks sobre OpenSpec)*

---

## 12. Esboço de aplicação para pi + Claude Code

> Sugestão para discussão, não validada em uso. Objetivo: **um só conjunto de documentos** que os dois agentes leem, com o mesmo ritual.

```text
repo/                                         # exemplo ilustrativo
├── AGENTS.md                 # fonte única de regras (pi lê nativamente; Claude Code também, se não houver CLAUDE.md)
├── CLAUDE.md                 # opcional: "@AGENTS.md" + extras do Claude Code (Windows: import, não symlink)
├── docs/
│   ├── STATE.md              # < 100 linhas; aponta active_spec / active_plan / próxima ação
│   ├── OPEN-QUESTIONS.md     # log de dúvidas (bloqueantes impedem aprovação)
│   ├── specs/2026-09-23-export-csv.md     # status: draft | approved
│   ├── plans/2026-09-23-export-csv.md     # tarefas com checkbox + comando de verificação
│   ├── decisions/0004-separador-csv.md    # MADR
│   └── handoffs/2026-09-23_1830-export-csv.md
├── .pi/prompts/              # /interview, /spec, /plan, /implement, /handoff  (templates do pi)
├── .agents/skills/           # skills no padrão Agent Skills (pi lê aqui)
└── .claude/
    ├── skills/               # cópia/equivalente das skills para o Claude Code (ele não lê .agents/skills)
    └── settings.json         # hooks: SessionStart injeta STATE.md; PreToolUse bloqueia src/ sem spec aprovada
```

- **Regras globais pessoais:** o pi usa `~/.pi/agent/AGENTS.md`; o Claude Code usa `~/.claude/CLAUDE.md`. Dá para manter um só arquivo colocando `@~/.pi/agent/AGENTS.md` no `~/.claude/CLAUDE.md` (imports de arquivos de usuário carregam sem diálogo, segundo a doc — **não testado**).
- **Ritual por feature (ambos os agentes):** `/interview` (entrevista → rascunho de spec + OPEN-QUESTIONS) → você revisa/aprova a spec (≤ 2 páginas) → `/plan` (plano com tarefas checkbox) → **sessão nova** `/implement` (uma tarefa por vez, TDD, evidência, commit, marca checkbox, atualiza STATE) → revisão por subagente/sessão nova → você lê o diff → ADR/STATE atualizados.
- **Gate "sem código antes da spec" no Claude Code** (hook `PreToolUse`) — **exemplo ilustrativo, não testado**:

```jsonc
// .claude/settings.json (trecho) — exemplo ilustrativo
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/spec-gate.mjs" }] }
    ],
    "SessionStart": [
      { "matcher": "startup|resume|clear|compact",
        "hooks": [{ "type": "command", "command": "node -e \"process.stdout.write(require('fs').readFileSync('docs/STATE.md','utf8'))\"" }] }
    ]
  }
}
```

```js
// .claude/hooks/spec-gate.mjs — exemplo ilustrativo, NÃO testado (ajuste caminhos/regras)
import { readFileSync, existsSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));                 // payload do hook via stdin
const file = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");
if (!/\/src\//.test(file)) process.exit(0);                          // só protege código de produção
const state = existsSync("docs/STATE.md") ? readFileSync("docs/STATE.md", "utf8") : "";
const spec = state.match(/^active_spec:\s*(\S+)/m)?.[1];
const ok = spec && existsSync(spec) && /^status:\s*approved/m.test(readFileSync(spec, "utf8"));
if (ok) process.exit(0);
console.error("Bloqueado: não há spec aprovada (docs/STATE.md → active_spec com status: approved). Faça a entrevista/spec primeiro.");
process.exit(2);                                                     // exit 2 = bloqueia e devolve a mensagem ao agente
```

- **No pi**, o equivalente seria uma extensão em `.pi/extensions/spec-gate.ts` ouvindo `tool_call` para as ferramentas de escrita/edição (formato exato de bloqueio **não verificado**), ou instalar um pacote que já faça gates (ex.: `pi-superpowers-plus`, **não auditado**). Alternativa sem código: a regra no `AGENTS.md` + disciplina + revisão.
- **Frameworks prontos compatíveis com os dois:** Superpowers (plugin oficial no Claude Code; `pi install git:github.com/obra/superpowers`), skills do Matt Pocock (padrão Agent Skills), GSD (GSD Core para Claude Code; **GSD 2/gsd-pi** é uma CLI própria sobre o Pi SDK, não um plugin do seu pi — **avaliar**).

---

## 13. Fontes consolidadas

**Anthropic**
- Best practices (docs): <https://code.claude.com/docs/en/best-practices>
- Memória / CLAUDE.md / AGENTS.md: <https://code.claude.com/docs/en/memory>
- Permission modes (plan mode): <https://code.claude.com/docs/en/permission-modes> · Settings: <https://code.claude.com/docs/en/settings-reference> · Hooks: <https://code.claude.com/docs/en/hooks> · Skills: <https://code.claude.com/docs/en/skills>
- Effective context engineering (2025-09-29): <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Effective harnesses for long-running agents (2025-11-26): <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Quickstart autonomous-coding: <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>
- Harness design for long-running application development (2026-03-24): <https://www.anthropic.com/engineering/harness-design-long-running-apps>

**Frameworks / workflows**
- Superpowers: <https://github.com/obra/superpowers> (skills em `skills/…`, `RELEASE-NOTES.md`); catálogo pi: <https://pi.dev/packages?name=superpowers>
- GSD Core: <https://github.com/open-gsd/gsd-core> · repo arquivado: <https://github.com/gsd-build/get-shit-done> · GSD 2 (Pi SDK): <https://github.com/open-gsd/gsd-pi> · <https://getshitdone.help/dev/architecture/>
- HumanLayer ACE: <https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md> · comandos: <https://github.com/humanlayer/humanlayer/tree/main/.claude/commands> · agente thoughts-locator: <https://github.com/humanlayer/humanlayer/blob/main/.claude/agents/thoughts-locator.md>
- QRSPI: palestra <https://www.youtube.com/watch?v=YwZR6tc7qYg> · <https://www.zenml.io/llmops-database/evolution-from-rpi-to-crispy-multi-stage-workflow-for-production-coding-agents> · <https://alexlavaee.me/blog/from-rpi-to-qrspi/> · <https://github.com/matanshavit/qrspi>
- Harper Reed: <https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/> · <https://harper.blog/2025/05/08/basic-claude-code/>
- Context engineering / PRP: <https://github.com/coleam00/context-engineering-intro> · <https://github.com/Wirasm/PRPs-agentic-eng>
- Cline: <https://docs.cline.bot/prompting/cline-memory-bank> · <https://docs.cline.bot/features/slash-commands/deep-planning>
- Matt Pocock skills: <https://github.com/mattpocock/skills>

**pi coding agent**
- <https://pi.dev> · <https://pi.dev/docs/latest/configuration> · <https://pi.dev/docs/latest/how-pi-works> · <https://pi.dev/docs/latest/sessions> · <https://pi.dev/docs/latest/skills>
- Prompt templates / extensões: <https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs>
- Mario Zechner (2025-11-30): <https://mariozechner.at/posts/2025-11-30-pi-coding-agent/>
- Releases: <https://github.com/earendil-works/pi/releases>

**Padrões e formatos**
- AGENTS.md: <https://agents.md/> · AAIF: <https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation>
- ADR: <https://adr.github.io/> · MADR: <https://adr.github.io/madr/>
- EARS: <https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax>
- llms.txt: <https://llmstxt.org/>

**Críticas e evidências**
- Böckeler, SDD tools (2025-10-15): <https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html>
- Böckeler, Harness engineering (2026-04-02): <https://martinfowler.com/articles/harness-engineering.html>
- Fowler, fragmento 2026-01-08 (Kent Beck): <https://martinfowler.com/fragments/2026-01-08.html>
- Rahul Garg (2026-04-08): <https://martinfowler.com/articles/reduce-friction-ai/> · SPDD (2026-04-28): <https://martinfowler.com/articles/structured-prompt-driven/>
- Thoughtworks Radar: <https://www.thoughtworks.com/radar/techniques/spec-driven-development> · <https://www.thoughtworks.com/en-us/radar/techniques> · <https://www.thoughtworks.com/en-us/radar/techniques/agent-instruction-bloat> · <https://www.thoughtworks.com/en-us/radar/techniques/context-engineering> · <https://www.thoughtworks.com/en-us/radar/techniques/curated-shared-instructions-for-software-teams> · <https://www.thoughtworks.com/en-us/radar/tools/openspec> · <https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit> · <https://www.thoughtworks.com/radar/techniques/agents-md>
- Marmelab (2025-11-12): <https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html>
- ETH Zurich, AGENTS.md (arXiv 2602.11988): <https://arxiv.org/abs/2602.11988> · resumo DAIR.AI: <https://academy.dair.ai/blog/agents-md-evaluation>
- Farrag (arXiv 2605.01160): <https://arxiv.org/abs/2605.01160> · InfoQ (2026-09-10): <https://www.infoq.com/articles/when-spec-driven-development-pays-off/>
- de Macedo (arXiv 2606.04967): <https://arxiv.org/abs/2606.04967>

### Itens não verificados (resumo)
- Default de `plansDirectory` no Claude Code.
- No pi: precedência entre `AGENTS.md` e `CLAUDE.md` no mesmo diretório; suporte a `@imports`; carregamento nativo de `AGENTS.md` aninhado abaixo do cwd; formato exato de bloqueio em `tool_call`.
- Ano das releases do pi (página não mostrava o ano; inferido 2026).
- Prompts oficiais do QRSPI (não publicados, segundo implementações comunitárias).
- Números do estudo Farrag lidos via resumo da InfoQ (paper lido só no abstract).
- Conteúdo da issue #512 do Superpowers (eficiência de brainstorming/writing-plans).
- Pacotes comunitários do pi citados (não auditados).
- Hooks/extensões de exemplo da §12 (não testados).
