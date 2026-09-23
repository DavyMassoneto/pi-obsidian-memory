# AGENTS.md — pi-obsidian-memory

Extensão do pi (TypeScript) que grava a memória de longo prazo do agente em vaults do Obsidian no OneDrive:
um vault **GLOBAL** (aprendizados sobre o usuário) e um vault por **PROJETO**. A base reaproveitada é o pi-hermes-memory (MIT).

## Onde estamos
Leia `docs/STATE.md` antes de tudo: ele traz a fase atual, a próxima ação e os bloqueios.
- Perguntas e decisões: `docs/OPEN-QUESTIONS.md`
- Pesquisa: `docs/research/`
- Decisões difíceis de reverter: `docs/decisions/`

## Não confunda
- **Sistema de SPEC** é como ESTE projeto é documentado (`docs/`, `openspec/`). Ele vive no repositório.
- **Sistema de MEMÓRIA** é o produto que estamos construindo. Os dados dele vivem nos vaults do Obsidian.

## Regras de processo (obrigatórias)
1. Nenhum código de produção sem duas condições: change aprovada no OpenSpec E nenhuma pergunta 🔴 aberta em `docs/OPEN-QUESTIONS.md`.
2. Dúvida que afete escopo, comportamento observável, formato em disco ou dados do usuário → pergunte
   (uma por vez, com opções e a sua recomendação) e registre em `docs/OPEN-QUESTIONS.md`. Não assuma.
3. Todo requisito declara (a) sua configuração (chave, default, validação) e (b) seu passo no onboarding (`/memory-setup` ou `/memory-init`).
4. Decisão difícil de reverter (formato em disco, API de tools, local dos dados) → ADR em `docs/decisions/` (MADR).
5. Se a realidade divergir da spec, PARE e informe: esperado, encontrado, impacto, como seguir. A spec é corrigida antes do código.
6. Ao fim de cada tarefa: rode os testes e MOSTRE a saída; marque o checkbox; atualize `docs/STATE.md`; faça commit.

## Fluxo (no pi os comandos usam hífen; no Claude Code, dois-pontos)
- Dúvida nova → `/entrevista <tema>`.
- Por mudança: `/opsx-explore` → `/opsx-propose` → aprovação do usuário → **sessão nova** → `/opsx-apply` → `/opsx-archive`.
- Contexto acima de ~60% ou troca de fase → atualize `docs/STATE.md` e comece uma sessão nova.

## Segurança de dados (OneDrive)
- Nunca grave SQLite, locks, temporários ou `.git` dentro dos vaults ou do OneDrive.
- Nunca sobrescreva uma nota de vault sem leitura completa + hash. Nunca apague: mova para `archive/`.
- O agente só lê e escreve dentro dos vaults de memória. Nada fora deles, como os vaults pessoais do usuário.

## Comandos
- A definir na F1: testes, typecheck e lint.
