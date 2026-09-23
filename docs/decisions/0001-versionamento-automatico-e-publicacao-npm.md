---
status: accepted
date: 2026-09-23
decision-makers: DavyMassoneto
---
# Versionamento automático com Git Flow e publicação no npm por Trusted Publishing

## Contexto e problema

O pacote `pi-obsidian-memory` é publicado no npm, e o projeto segue o Git Flow: `main` só recebe releases e `dev` é a integração. O usuário quer versionamento automático, sem escolher o número de versão à mão.

## Fatores de decisão

- Manter o Git Flow intacto (`release/*` → `main` + tag → `dev`), com merges `--no-ff`.
- A versão sai do histórico, não de uma escolha manual.
- Publicar sem token guardado no repositório.
- Poucas dependências externas.

## Opções consideradas

1. **Comando de release próprio + GitHub Actions disparado pela tag.**
2. **semantic-release:** versão, tag e publicação automáticas a cada merge na `main`, via PR `dev` → `main`.
3. **release-please:** um bot mantém um PR de release na `main`.

## Resultado

**Opção 1.** Você decide **quando** lançar (`npm run release`), e o **número** sai dos Conventional Commits desde a última tag `v*`.

| Commits desde a última tag | Em 0.x | A partir de 1.0 |
|---|---|---|
| `BREAKING CHANGE:` no corpo ou `tipo!:` | minor | major |
| `feat:` | minor | minor |
| `fix:` / `perf:` | patch | patch |
| Só outros tipos (`docs:`, `chore:`…) | nada, a menos que se use `--bump` | idem |

O que o `scripts/release.mjs` faz:
1. confere que está na `dev`, sem mudanças pendentes e sincronizada;
2. calcula a versão;
3. roda `git flow release start X.Y.Z`;
4. atualiza `package.json` e `CHANGELOG.md` e commita `chore(release): vX.Y.Z`;
5. roda `git flow release finish X.Y.Z`, que faz o merge na `main`, cria a tag `vX.Y.Z` e volta para a `dev`;
6. faz push de `main`, `dev` e tag.

A tag dispara o `.github/workflows/release.yml`, que:
- confere que a tag bate com o `package.json` e está na `main`;
- roda os testes;
- publica no npm via **Trusted Publishing (OIDC)**, que gera o atestado de procedência (provenance) automaticamente;
- cria a GitHub Release com a seção do changelog.

### Consequências

- Bom: o Git Flow não muda. O script não tem dependências. `--dry-run` mostra o plano antes.
- Bom: a publicação não usa `NPM_TOKEN` e sai com procedência verificável.
- Ruim: depende de mensagens no padrão Conventional Commits. Commits fora do padrão não contam para a versão (o script avisa quais são).
- Ruim: a 1ª publicação é manual (`0.0.0`, só para reservar o nome), porque o Trusted Publishing é configurado num pacote que já existe no npm.
- A keyword `pi-package` e o manifesto `pi` do `package.json` entram na 1ª versão funcional. Antes disso, o pacote não aparece na galeria do pi.dev.

### Confirmação

- `npm run release -- --dry-run` mostra versão, changelog e commits fora do padrão sem alterar nada.
- O workflow recusa tag que não bate com o `package.json` ou que não está na `main`.
