# AGENTS.md — pi-obsidian-memory

Extensão do pi (TypeScript) que grava a memória de longo prazo do agente em vaults do Obsidian, em qualquer pasta.
O **OneDrive é opcional**. São dois tipos de vault: um **GLOBAL** (aprendizados sobre o usuário) e um por **PROJETO**.
A base reaproveitada é o pi-hermes-memory (MIT).

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
6. Ao fim de cada tarefa: rode os testes e MOSTRE a saída; marque o checkbox; atualize `docs/STATE.md`; faça commit **na branch da feature**.

## Fluxo (no pi os comandos usam hífen; no Claude Code, dois-pontos)
- Dúvida nova → `/entrevista <tema>`.
- Por mudança: `/opsx-explore` → `/opsx-propose` → aprovação do usuário → **sessão nova** → `/opsx-apply` → `/opsx-archive`.
- Contexto acima de ~60% ou troca de fase → atualize `docs/STATE.md` e comece uma sessão nova.

## Git Flow (obrigatório, com git-flow-next; a configuração está em `.gitflow`)
- `main` = só releases (cada merge tem tag `vX.Y.Z`). `dev` = integração. **Nunca faça commit direto em `main` ou `dev`.**
- Todo trabalho, inclusive documentação, começa com `git flow feature start <nome-curto>` (sai de `dev`).
  - Uma change do OpenSpec corresponde a uma feature. Nomes em kebab-case, por exemplo `feature/f0-visao-requisitos`.
- Feature concluída **e aprovada pelo usuário**: `git flow feature finish <nome>`, que faz merge `--no-ff` em `dev` e apaga a branch. Depois, `git push origin dev`.
  - Se o usuário pedir revisão por PR: `git push -u origin feature/<nome>` + `gh pr create --base dev`.
- Release: `git flow release start X.Y.Z` → versão no `package.json` + changelog → `git flow release finish X.Y.Z`.
  - Isso faz o merge em `main`, cria a tag `vX.Y.Z` e volta para `dev`.
  - Depois: `git push origin main dev --follow-tags`.
- Correção urgente em produção: `git flow hotfix start X.Y.Z` (sai de `main`) → `git flow hotfix finish X.Y.Z`.
- Versionamento SemVer; a primeira release é `0.1.0`. Mensagens de commit no estilo Conventional Commits (`feat:`, `fix:`, `docs:`…).

## Segurança de dados
- O **OneDrive é opcional**, e o núcleo não pode depender dele. As proteções de OneDrive (pin, arquivos só-na-nuvem, cópias de conflito) só rodam com `sync.provider = onedrive`, detectado e confirmado no onboarding.
- Nunca grave SQLite, locks, temporários ou `.git` dentro dos vaults. Isso vale sempre, e é crítico em pasta sincronizada.
- Nunca sobrescreva uma nota de vault sem leitura completa + hash. Nunca apague: mova para `archive/`.
- O agente só lê e escreve dentro dos vaults de memória. Nada fora deles, como os vaults pessoais do usuário.

## Comandos
- A definir na F1: testes, typecheck e lint.
