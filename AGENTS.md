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
- Release (**só quando o usuário pedir**): `npm run release -- --dry-run` para conferir e depois `npm run release`.
  - O git-cliff calcula a versão e o changelog (regras no `cliff.toml`), e o `scripts/release/` orquestra o `git flow release start/finish`, a tag `vX.Y.Z` e o push.
  - O script pede confirmação. `--yes` pula a pergunta e só pode ser usado com autorização explícita do usuário.
  - A tag dispara a publicação no npm (`.github/workflows/release.yml`). Detalhes em `docs/decisions/0001-versionamento-automatico-e-publicacao-npm.md`.
- Correção urgente em produção: `git flow hotfix start X.Y.Z` (sai de `main`) → `git flow hotfix finish X.Y.Z`.
- Versionamento SemVer; a primeira release funcional é `0.1.0`.
- Mensagens de commit **obrigatoriamente** no padrão Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…; `!` ou `BREAKING CHANGE:` para quebras), porque o versionamento automático depende disso.
- **Nunca** inclua trailers de coautoria (`Co-Authored-By`) nem qualquer menção a IA em commits, merges, tags ou PRs.

## Segurança de dados
- O **OneDrive é opcional**, e o núcleo não pode depender dele. As proteções de OneDrive (pin, arquivos só-na-nuvem, cópias de conflito) só rodam com `sync.provider = onedrive`, detectado e confirmado no onboarding.
- Nunca grave SQLite, locks, temporários ou `.git` dentro dos vaults. Isso vale sempre, e é crítico em pasta sincronizada.
- Nunca sobrescreva uma nota de vault sem leitura completa + hash. Nunca apague: mova para `archive/`.
- O agente só lê e escreve dentro dos vaults de memória. Nada fora deles, como os vaults pessoais do usuário.

## Código (TypeScript)
O Biome barra automaticamente, no `npm run lint` e no CI (configuração em `biome.json` e plugins em `biome/`):
- código fora da formatação (sem ponto e vírgula, linha de 120 colunas);
- imports fora de ordem ou fora dos grupos: Node, pacotes do npm e arquivos do projeto, separados por uma linha em branco;
- arquivo com mais de 200 linhas e função com mais de 30, sem contar as linhas em branco. Nos testes vale só o limite de arquivo, porque o `describe()` conta como função;
- `any`, `unknown`, type assertion (`x as T`, `<T>x`, `x!`; `as const` pode) e index signature, inclusive `Record<string, T>` e `{ [K in string]: T }`. `Record` com chaves fixas pode.

Cada tipo de coisa fica no seu arquivo, junto do módulo (`plan.ts` → `plan.types.ts`, `plan.constants.ts`…). O Biome barra no código; nos testes, não vale:
- tipos e interfaces → `<módulo>.types.ts`;
- valor no topo do módulo que não é função (texto, número, regex, lista, objeto, `Map`…) → `<módulo>.constants.ts`;
- schema do TypeBox → `<módulo>.schemas.ts`. O construtor `Type` só é importado lá; nos outros arquivos, use `import type`;
- classe de erro (que estende `Error`) → `<módulo>.errors.ts`;
- estilo (`theme.fg`, `theme.bold`… do pi e bibliotecas de cor como `chalk`) → `<módulo>.styles.ts`.

Valem também, mesmo sem o Biome pegar:
- Dado externo (JSON, configuração) passa por um schema do TypeBox (`typebox`, o mesmo do pi), nunca por cast.
- Comentário só quando explica um porquê que o código não mostra. JSDoc que repete o nome é proibido: prefira nomes descritivos.
- Nunca desligue uma regra com `biome-ignore`. Se uma regra parecer errada para um caso, pergunte ao usuário.

## Comandos
- Lint, formatação e imports (Biome): `npm run lint`. Para corrigir o que for automático: `npm run format`
- Tipos (TypeScript estrito): `npm run typecheck`
- Testes (vitest): `npm test`
- Release: `npm run release -- --dry-run` / `npm run release` (ver Git Flow acima)
