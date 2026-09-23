# STATE — pi-obsidian-memory

- **Fase:** F0 — Descoberta (sem código). Configs prontas; próximo passo: visão e requisitos.
- **Atualizado:** 2026-09-23
- **Bloqueios:** nenhum. Todas as perguntas estão respondidas em [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## Feito
- Estudo pré-projeto em [research/](research/README.md).
- Entrevista completa em 11 rodadas; todas as respostas estão em `OPEN-QUESTIONS.md`. Leia primeiro a seção ⚠️, com as decisões que fugiram da recomendação.
- Repositório com `AGENTS.md`, `docs/` e o prompt `/entrevista` (em `.pi/prompts/` e `.claude/commands/`).
- **OpenSpec 1.13.1** instalado (global, no Node 24 do fnm):
  - `openspec init --tools pi,claude --language pt-BR`;
  - `openspec/config.yaml` com o contexto do projeto, 12 regras por artefato e orientação para apply e archive;
  - telemetria do OpenSpec desligada.
- **PowerShell 7:** o perfil agora ativa o fnm, então `node` (v24.20.0), `openspec` e `pi` ficam disponíveis ao abrir o terminal.

## Decisões-chave (detalhes em OPEN-QUESTIONS.md)
- **Sistema de spec ≠ sistema de memória.** Os docs do projeto ficam no repositório; os vaults guardam só memórias.
- **Método e produto:** OpenSpec + `docs/` + `/entrevista`. Quem implementa é o pi. É um pacote novo, reusando módulos do pi-hermes-memory (MIT).
- **Vaults e conteúdo:**
  - um vault global dedicado + um por projeto, cadastrados por mapa manual via `/memory-init`;
  - notas **em inglês**, nativas do Obsidian, com índice e templates propostos pelo agente;
  - só aprendizados e pontos importantes.
- **Prompt e busca:**
  - resumo global + projeto de ~3k tokens; "Não esquecer" entra sempre, sem limite;
  - busca **texto + semântica já na v1**, com índices locais;
  - `session_search` mantido.
- **Dados:**
  - o agente só mexe nos vaults de memória, e pode renomear corrigindo os links;
  - nada é apagado (vai para `archive/`);
  - pin no OneDrive com confirmação;
  - segredos permitidos (configurável);
  - vaults sem plugins que reescrevem arquivos.
- **Engenharia:** Node ≥ 24 · vitest + CI no Windows · npm + `pi install` · Windows primeiro · logs + estatísticas locais.

## Próxima ação
Abrir o **PowerShell 7** em `D:\Projects\pi-obsidian-memory`, rodar `pi` e colar o prompt abaixo.

## Prompt da próxima sessão (pi)
```text
Leia AGENTS.md, docs/STATE.md e docs/OPEN-QUESTIONS.md (comece pela seção ⚠️). A pesquisa está em docs/research/.
Estamos na F0: todas as perguntas foram respondidas. Não reabra decisões já tomadas; se surgir dúvida nova,
use /entrevista (uma pergunta por vez, com opções e recomendação) e registre em docs/OPEN-QUESTIONS.md.
Proponha, nesta ordem, parando para minha aprovação a cada uma:
1. docs/00-visao.md
2. docs/01-requisitos.md: EARS; v1/v2/fora; cada requisito com sua configuração (chave, default, validação) e seu passo
   de onboarding (/memory-setup ou /memory-init)
3. docs/02-arquitetura.md (≤ 2 páginas) + ADRs em docs/decisions/ para as decisões difíceis de reverter
4. docs/03-roadmap.md: fases; cada fase vira uma ou mais changes do OpenSpec
Não escreva código. Ao final, atualize docs/STATE.md.
```
