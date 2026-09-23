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

A versão e o changelog vêm do **git-cliff**, com as regras no `cliff.toml`. O `scripts/release/` (TypeScript, rodado direto pelo Node 24) só orquestra o Git Flow:
1. verifica, sem alterar nada:
   - git-flow instalado;
   - estar na `dev`, com a árvore limpa e nenhuma release aberta;
   - `dev` e `main` iguais às do GitHub (via `ls-remote`, sem fetch);
   - `package.json` igual à última tag;
2. calcula a versão (`git-cliff --bumped-version`);
3. mostra o plano e a prévia do changelog (o `--dry-run` para aqui) e pede confirmação;
4. `git flow release start X.Y.Z`;
5. atualiza `package.json` e `package-lock.json`, regenera o `CHANGELOG.md` e commita `chore(release): vX.Y.Z`;
6. `git flow release finish X.Y.Z`: merge na `main`, tag `vX.Y.Z` e volta para a `dev`;
7. `git push --atomic` de `main`, `dev` e da tag.

Se um passo falha, o script mostra o que já foi feito e como seguir ou desfazer.

A tag dispara o `.github/workflows/release.yml`, que:
- confere que a tag bate com o `package.json` e está na `main`;
- roda os testes;
- publica no npm via **Trusted Publishing (OIDC)**, que gera o atestado de procedência (provenance) automaticamente;
- cria a GitHub Release com a seção do changelog.

### Consequências

- Bom: o Git Flow não muda. A versão e o changelog ficam com uma ferramenta madura (git-cliff, MIT/Apache-2.0, só em desenvolvimento), e o nosso código só orquestra. `--dry-run` mostra o plano antes.
- Bom: a publicação não usa `NPM_TOKEN` e sai com procedência verificável.
- Ruim: depende de mensagens no padrão Conventional Commits. Commits fora do padrão não contam para a versão (o script avisa quais são).
- Ruim: a 1ª publicação é manual (`0.0.0`, só para reservar o nome), porque o Trusted Publishing é configurado num pacote que já existe no npm.
- A keyword `pi-package` e o manifesto `pi` do `package.json` entram na 1ª versão funcional. Antes disso, o pacote não aparece na galeria do pi.dev.

### Confirmação

- `npm run release -- --dry-run` mostra a versão, os passos e a prévia do changelog sem alterar nada.
- `npm test` cobre o plano, as verificações, o formato de versão e as regras reais do `cliff.toml`, com repositórios git temporários.
- O workflow recusa tag que não bate com o `package.json` ou que não está na `main`.

### Revisão (2026-09-23)

A primeira versão do script reimplementava o parser de Conventional Commits, a conta de SemVer e o changelog, sem testes. Foi substituída pelo git-cliff mais a orquestração em TypeScript descrita acima.
