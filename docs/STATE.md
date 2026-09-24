# STATE — pi-obsidian-memory

- **Fase:** F0 — Descoberta (sem código). Configs prontas; próximo passo: visão e requisitos.
- **Atualizado:** 2026-09-23
- **Bloqueios:** nenhum. Todas as perguntas estão respondidas em [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## Feito
- Estudo pré-projeto em [research/](research/README.md).
- Entrevista completa em 12 rodadas; todas as respostas estão em `OPEN-QUESTIONS.md`. Leia primeiro a seção ⚠️, com as decisões que fugiram da recomendação.
- Repositório com `AGENTS.md`, `docs/` e o prompt `/entrevista` (em `.pi/prompts/` e `.claude/commands/`).
- **OpenSpec 1.13.1** (global, no Node 24 do fnm):
  - inicializado para pi e Claude Code, em pt-BR;
  - `openspec/config.yaml` com o contexto, as regras e o Git Flow;
  - telemetria desligada.
- **Git Flow** com **git-flow-next 2.0**:
  - `main` (releases) e `dev` (integração);
  - configuração versionada em `.gitflow`;
  - regras no `AGENTS.md`.
- **GitHub:** repositório **público** em https://github.com/DavyMassoneto/pi-obsidian-memory, com branch padrão **`dev`**; `main` e `dev` publicadas. A GitHub CLI 2.101 está autenticada (use `gh pr create --base dev` quando o usuário pedir PR).
- **PowerShell 7:** o perfil ativa o fnm, então `node` (v24), `openspec`, `pi`, `gh` e `git flow` ficam disponíveis.
- **npm** (pacote `pi-obsidian-memory`, MIT, conta `davy121`), com publicação automática configurada:
  - `npm run release` calcula a versão pelos Conventional Commits (git-cliff, regras no `cliff.toml`) e roda o Git Flow (`scripts/release/`, em TypeScript, com testes);
  - a tag `v*` na `main` dispara o `.github/workflows/release.yml`, que publica via Trusted Publishing e cria a GitHub Release. Só esse workflow pode publicar;
  - detalhes no [ADR 0001](decisions/0001-versionamento-automatico-e-publicacao-npm.md).
- **CI** (`.github/workflows/ci.yml`, Windows): roda a cada push nas branches do Git Flow e em cada PR (Biome, tipos, testes e OpenSpec).
- **Biome** para lint, formatação e imports (`npm run lint` / `npm run format`), com as regras de código do `AGENTS.md`: sem `;`, limites de 200 linhas por arquivo e 30 por função, sem `any`, `unknown`, type assertion nem index signature. Todo módulo é uma pasta, com um arquivo por tipo de coisa (`types.ts`, `constants.ts`, `schemas.ts`, `errors.ts`, `styles.ts`); os testes espelham as pastas.

## Decisões-chave (detalhes em OPEN-QUESTIONS.md)
- **Sistema de spec ≠ sistema de memória.** Os docs do projeto ficam no repositório; os vaults guardam só memórias.
- **Método e produto:** OpenSpec + `docs/` + `/entrevista`. Quem implementa é o pi. É um pacote novo, reusando módulos do pi-hermes-memory (MIT).
- **Vaults e conteúdo:**
  - vaults do Obsidian **em qualquer pasta**; o **OneDrive é opcional**, detectado e confirmado no onboarding (`sync.provider = none | onedrive`);
  - um vault global dedicado + um por projeto, cadastrados por mapa manual via `/memory-init`;
  - notas **em inglês**, nativas do Obsidian, com índice e templates;
  - só aprendizados e pontos importantes.
- **Prompt e busca:**
  - resumo global + projeto de ~3k tokens; "Não esquecer" entra sempre, sem limite;
  - busca **texto + semântica já na v1**, com índices locais.
- **Dados:**
  - o agente só mexe nos vaults de memória, e pode renomear corrigindo os links;
  - nada é apagado (vai para `archive/`);
  - segredos permitidos (configurável).
- **Engenharia:**
  - Node ≥ 24 · vitest + CI no Windows · Biome · TypeBox para dado externo · npm + `pi install` · Windows primeiro;
  - **Git Flow**: nada de commit direto em `main` ou `dev`; `feature/` só para funcionalidade do produto, `chore/` para organização, ferramentas e processo.

## Próxima ação
1. **Usuário:** abrir o **PowerShell 7** nesta pasta, rodar `pi` e colar o prompt abaixo.
2. Releases: `npm run release` (só quando o usuário pedir). A primeira versão funcional será a `0.1.0`.

## Prompt da próxima sessão (pi)
```text
Leia AGENTS.md, docs/STATE.md e docs/OPEN-QUESTIONS.md (comece pela seção ⚠️). A pesquisa está em docs/research/.
Estamos na F0: todas as perguntas foram respondidas. Não reabra decisões já tomadas; se surgir dúvida nova,
use /entrevista (uma pergunta por vez, com opções e recomendação) e registre em docs/OPEN-QUESTIONS.md.
Siga o Git Flow do AGENTS.md: comece com `git flow chore start f0-visao-requisitos`.
Proponha, nesta ordem, parando para minha aprovação a cada uma (um commit por documento aprovado):
1. docs/00-visao.md
2. docs/01-requisitos.md: EARS; v1/v2/fora; cada requisito com sua configuração (chave, default, validação) e seu passo
   de onboarding (/memory-setup ou /memory-init)
3. docs/02-arquitetura.md (≤ 2 páginas) + ADRs em docs/decisions/ para as decisões difíceis de reverter
4. docs/03-roadmap.md: fases; cada fase vira uma ou mais changes do OpenSpec (e uma feature do Git Flow)
Não escreva código. Ao final, atualize docs/STATE.md e, com a minha aprovação, rode
`git flow chore finish f0-visao-requisitos` e `git push origin dev`.
```
