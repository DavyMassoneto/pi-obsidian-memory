# 02 — Comparativo, evidências e quanto processo usar

> As versões e estrelas foram lidas em 2026-09-23. Fontes nos anexos [A](anexos/A-sdd-toolkits.md) e [B](anexos/B-sdd-workflows.md).

## Tabela comparativa

| Ferramenta / fluxo | Peso | pi | Claude Code | Perguntas antes do código | Contexto entre sessões | Licença · versão |
|---|---|---|---|---|---|---|
| **GitHub Spec Kit** | Médio-alto | ✅ oficial (`.pi/prompts`) | ✅ skills | ⭐⭐⭐ `[NEEDS CLARIFICATION]` (≤3) + `clarify` (≤5, uma por vez, gravadas na spec) + checklist bloqueia o `implement` | `constitution.md` + `specs/NNN/` + `[X]` no `tasks.md` + `converge` | MIT · v1.0.10 |
| **OpenSpec** | Baixo | ✅ oficial (v1.2+) | ✅ | ⭐ `explore` (nunca codifica); `propose` pergunta só se a ambiguidade for relevante | `config.yaml` injetado + `specs/` vivas + `archive/` datado + `status --json` | MIT · v1.13.1 |
| **Superpowers** | Médio | ✅ `pi install git:…` | ✅ plugin | ⭐⭐⭐ Hard gate + 1 pergunta por mensagem + aprovação por seção | Spec + plano versionados + ledger `progress.md` | MIT · v6.4.x |
| **GSD Core** | Alto | ⚠️ só no branch `next` | ✅ | ⭐⭐ `new-project` + `discuss-phase` (decisões travadas vs. a critério do agente) | `STATE.md` (<100 linhas) + `HANDOFF.json` + `resume-work` | MIT · v1.14.0 |
| **BMAD** | Alto (escala conforme a tarefa desde a 6.12) | ✅ `--tools pi` | ✅ | ⭐⭐ Elicitation, PRD guiado, lacunas viram open questions | `_bmad-output/` + `sprint-status.yaml` | MIT+TM · v6.12 |
| **Kiro** | Médio | ❌ | ❌ | ⭐⭐ Aprovação por fase + *Analyze Requirements* | Steering + specs | Proprietário |
| **cc-sdd** (Kiro-like) | Médio | ❌ | ✅ | ⭐⭐ `discovery` + validações por fase | `.kiro/steering` + `spec.json` | MIT · v3.0.2 |
| **Agent OS** v3 | Baixo-médio | ❌ | ✅ | ⭐ `/shape-spec` em plan mode | Standards + specs | MIT · v3.0.0 |
| **Task Master** | Médio | ❌ (CLI via shell) | ✅ MCP | Fraco (depende do PRD) | `tasks.json` + `next` | MIT+Commons Clause · parado |
| **Anthropic (práticas oficiais)** | Leve | ✅ (é só prompt + arquivos) | ✅ nativo | ⭐⭐ Entrevista com `AskUserQuestion` → `SPEC.md` → sessão nova | `CLAUDE.md`/`AGENTS.md` + spec + git | — |
| **Harper Reed** | Mínimo | ✅ | ✅ | ⭐⭐ "Uma pergunta por vez" até a spec | `prompt_plan.md` + `todo.md` com checkboxes | — |
| **HumanLayer RPI/QRSPI** | Médio | ✅ (prompts) | ✅ | ⭐⭐ Só pergunta o que o código não responde; design de ~200 linhas | `thoughts/` + handoffs + checkboxes no plano | — |

⭐ = força do mecanismo de "perguntar antes".

## O que as evidências dizem (2025–2026)

| Fonte | Achado | Implicação para nós |
|---|---|---|
| **ETH Zurich** (arXiv 2602.11988, 2026) | Arquivos de contexto (AGENTS.md) **não melhoram** o sucesso em geral e **custam mais de 20% a mais**. A visão geral do repositório não ajuda; instruções específicas são seguidas | `AGENTS.md` **mínimo**, escrito por nós, só com regras e o que não dá para inferir do código |
| **InfoQ / Farrag** (set/2026) | Spec deu **+21 pontos** a modelos mais fracos e **+2** aos fortes. Revisão com spec: **48 min vs 27 min**. **Não achou mais bugs** (recall ~0,52 nos dois), mas tornou **81%** dos achados rastreáveis a requisitos (vs 0%) | O ganho está em **alinhamento e rastreabilidade**, não em "achar mais bugs". Vale onde há ambiguidade, várias sessões e risco, que é o nosso caso (dados no OneDrive) |
| **Scott Logic** (nov/2025, Spec Kit pré-1.0) | 2.577 linhas de markdown para 689 de código; 3,5 h de revisão vs 24 min no modo iterativo | Processo pesado em tarefa pequena **não compensa**. Artefatos curtos |
| **HumanLayer** (autocrítica, mar/2026) | Planos de ~1.000 linhas **não são lidos**. O ponto de revisão deve ser um design de ~200 linhas. **Ler o código continua obrigatório** | Revisar cedo e curto; a spec não substitui a leitura do diff |
| **Thoughtworks Radar** (abr/2026) | Context engineering em **Adopt**; Spec Kit e OpenSpec em **Assess**; "agent instruction bloat" em **Caution** | Adotar os padrões; tratar as ferramentas como opcionais; podar instruções |
| **Böckeler** (martinfowler.com, out/2025) | Três níveis: *spec-first* (vale a pena), *spec-anchored*, *spec-as-source* (duvidoso). Crítica: falsa sensação de controle e fluxo único para todo tamanho de problema | Spec-first sempre; spec-anchored só para o que é durável (comportamento do sistema) |
| **Marmelab / Kent Beck** | "Waterfall com markdown": pressupõe que nada se aprende durante a implementação | Spec **viva**: quando a realidade diverge, conserta-se a spec primeiro e depois o código |

## Quanto processo usar: matriz de dimensionamento

| Tamanho | Sinais | Processo | Artefatos |
|---|---|---|---|
| **Trivial** | O diff cabe numa frase | Pedir direto + teste + commit | Nenhum |
| **Pequeno** | 1–3 arquivos, sem decisão arquitetural | 3–5 perguntas → mini-design no chat → aprovação → TDD | Nota no STATE/commit |
| **Feature** | Vários arquivos, alguma ambiguidade | Entrevista → spec curta (≤ 2 páginas) → plano com checkbox → **sessão nova** implementa → revisão | spec, plano, ADR se houver decisão, STATE |
| **Projeto novo** ← *o de memória* | Vários subsistemas, várias sessões, decisões difíceis de reverter | Pesquisa → visão → requisitos (IDs, v1/v2/fora) → arquitetura + ADRs → roadmap em fases → por fase: entrevista → spec → plano → execução → verificação | Tudo acima + roadmap e STATE de projeto |
| **Crítico / dados do usuário** ← *parcialmente o nosso* (risco de apagar notas no OneDrive) | Perda de dados, segurança | Acrescentar rastreabilidade requisito ↔ teste e checagem de drift | + testes que citam o requisito (`R-07`) |

**Suba de nível quando:** aparecer complexidade escondida, a decisão for difícil de reverter (formato de arquivo, API de tools) ou o trabalho atravessar sessões.
**Desça de nível quando:** você parar de ler os artefatos, a spec ficar maior que o código ou a revisão custar mais que a economia.

## Anti-padrões citados por várias fontes

- `AGENTS.md`/`CLAUDE.md` inchado, ou gerado por LLM, que descreve o repositório em vez de dar regras.
- Spec longa que ninguém lê; plano de 1.000 linhas.
- "Vou confiar e depois verificar": o agente diz "pronto" sem mostrar a saída do teste.
- Sessão "pia de cozinha": tarefas misturadas e contexto acima de 60%.
- Dois toolkits de SDD ativos no mesmo repositório, com fontes da verdade conflitantes.
- Corrigir o código sem atualizar a spec (drift).
