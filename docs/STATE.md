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
- **GitHub CLI 2.101** instalada. Repositório **público** com branch padrão **`dev`**, criado depois do `gh auth login`.
- **PowerShell 7:** o perfil ativa o fnm, então `node` (v24), `openspec`, `pi`, `gh` e `git flow` ficam disponíveis.

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
  - Node ≥ 24 · vitest + CI no Windows · npm + `pi install` · Windows primeiro;
  - **Git Flow**: nada de commit direto em `main` ou `dev`.

## Próxima ação
1. **Usuário:** rodar `gh auth login` (uma vez).
2. Criar o repositório público no GitHub, fazer push de `main` e `dev` e definir `dev` como padrão.
3. **Usuário:** abrir o **PowerShell 7** nesta pasta, rodar `pi` e colar o prompt abaixo.
4. Mais tarde: configurar a publicação no npm.

## Prompt da próxima sessão (pi)
```text
Leia AGENTS.md, docs/STATE.md e docs/OPEN-QUESTIONS.md (comece pela seção ⚠️). A pesquisa está em docs/research/.
Estamos na F0: todas as perguntas foram respondidas. Não reabra decisões já tomadas; se surgir dúvida nova,
use /entrevista (uma pergunta por vez, com opções e recomendação) e registre em docs/OPEN-QUESTIONS.md.
Siga o Git Flow do AGENTS.md: comece com `git flow feature start f0-visao-requisitos`.
Proponha, nesta ordem, parando para minha aprovação a cada uma (um commit por documento aprovado):
1. docs/00-visao.md
2. docs/01-requisitos.md: EARS; v1/v2/fora; cada requisito com sua configuração (chave, default, validação) e seu passo
   de onboarding (/memory-setup ou /memory-init)
3. docs/02-arquitetura.md (≤ 2 páginas) + ADRs em docs/decisions/ para as decisões difíceis de reverter
4. docs/03-roadmap.md: fases; cada fase vira uma ou mais changes do OpenSpec (e uma feature do Git Flow)
Não escreva código. Ao final, atualize docs/STATE.md e, com a minha aprovação, rode
`git flow feature finish f0-visao-requisitos` e `git push origin dev`.
```
