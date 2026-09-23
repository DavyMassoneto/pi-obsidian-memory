# Estudo pré-projeto: documentação para LLMs + memória em Obsidian

> Data: **2026-09-23**. Foram 4 pesquisas web paralelas, com leitura de docs e código-fonte, sem instalar nem executar nada. As afirmações mais surpreendentes foram reconferidas nas fontes primárias.
> Status: **rascunho para decisão**. Nenhum código foi escrito, e as escolhas estão em [06-perguntas-abertas.md](06-perguntas-abertas.md).

> **Atualização 2026-09-23 (depois da entrevista):** as decisões valem a partir de [../OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md), e este estudo fica como registro da pesquisa. Estas premissas e propostas foram **superadas**:
> - OneDrive obrigatório → **OneDrive opcional**, detectado e confirmado no onboarding (`sync.provider`);
> - memória numa pasta do vault pessoal do usuário → **vaults dedicados**: um global e um por projeto;
> - daily log por dispositivo → **só aprendizados e pontos importantes**, com templates;
> - docs do projeto no vault → **sistema de spec (repositório) ≠ sistema de memória (vaults)**.

## TL;DR

**1. A comunidade tem, sim, uma forma de documentar para a LLM não se perder:** é o *Spec-Driven Development*, sustentado por *context engineering*. Todas as abordagens convergem em 7 padrões:
1. arquivo de regras curto (`AGENTS.md`);
2. entrevista antes da spec;
3. spec curta como fonte da verdade;
4. log de perguntas abertas + ADRs;
5. plano em tarefas pequenas com checkbox e comando de verificação;
6. estado em arquivo + git + **sessão nova por fase**;
7. verificação executável + gates por hook.

→ [01](01-panorama-sdd.md)

**2. Toolkits prontos que rodam no pi E no Claude Code:**
- **Spec Kit:** o mais rígido em "perguntar e checar antes".
- **OpenSpec:** leve, com specs vivas.
- **Superpowers:** a melhor disciplina de entrevista e TDD.
- **BMAD:** completo, mas pesado.

Kiro, Agent OS, Task Master e cc-sdd não rodam no pi. → [02](02-comparativo-e-evidencias.md)

**3. A evidência pede moderação:**
- `AGENTS.md` longo ou gerado por LLM **não ajuda** e custa mais de 20% a mais (ETH Zurich, 2026).
- Spec ajuda em **alinhamento e rastreabilidade**, não em achar mais bugs (InfoQ, set/2026).
- Planos longos não são lidos (HumanLayer).

Artefatos curtos, revisados cedo, e o código continua sendo lido.

**4. Sobre o pi-hermes-memory** (v0.9.9, **MIT**, dá para reaproveitar mantendo os avisos de copyright):
- No modo padrão, o limite de 5.000 chars **já não é aplicado** às escritas. O limite real é **o que chega ao modelo**, porque a busca é lexical e ajustada para inglês.
- **Não existe camada de storage** para trocar.
- Apontar a pasta para o vault leva SQLite, locks, temporários e hard links para o OneDrive, o que **não é recomendado**.

→ [03](03-pi-hermes-memory-anatomia.md)

**5. Obsidian + OneDrive:**
- Não há solução pronta. O basic-memory é a mais próxima, mas é AGPL, então só dá para aproveitar ideias.
- O caminho é **FS-first**: o vault guarda **só Markdown**; índice, locks e config ficam locais.
- O risco nº 1 são os **placeholders do OneDrive**, que já causaram perda real de dados com agentes. Há mitigações em código.

→ [04](04-memoria-obsidian-onedrive.md)

**6. Proposta** (→ [05](05-proposta-reaproveitamento.md)):
- **Metodologia ★:** OpenSpec + camada de projeto em `docs/` + um gate de perguntas nosso (`/entrevista` + `OPEN-QUESTIONS.md` + regras no `AGENTS.md`).
- **Projeto ★:** pacote novo "Obsidian-first", reaproveitando do pi-hermes-memory o scanner, os prompts, o review, o flush, a detecção de correção e a busca de sessões, e trocando a persistência por um `VaultBackend` seguro para OneDrive, com onboarding `/memory-setup` e `/memory-doctor`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| [01-panorama-sdd.md](01-panorama-sdd.md) | Os 7 padrões em código + como cada toolkit ou fluxo é usado (comandos, árvores, artefatos) |
| [02-comparativo-e-evidencias.md](02-comparativo-e-evidencias.md) | Tabela comparativa, evidências de 2025–2026, matriz de "quanto processo usar", anti-padrões |
| [03-pi-hermes-memory-anatomia.md](03-pi-hermes-memory-anatomia.md) | Como a base funciona por dentro, o que é o "limite", pontos de corte, API de extensões do pi |
| [04-memoria-obsidian-onedrive.md](04-memoria-obsidian-onedrive.md) | Prior art (basic-memory, OpenClaw, Letta…), recuperação ilimitada, armadilhas do OneDrive, auto-detecção |
| [05-proposta-reaproveitamento.md](05-proposta-reaproveitamento.md) | Trilhas de metodologia, estrutura de docs, `AGENTS.md`/`/entrevista`/`config.yaml` prontos, mapa módulo a módulo, roadmap, **prompt de kickoff revisado** |
| [06-perguntas-abertas.md](06-perguntas-abertas.md) | 49 perguntas (20 🔴 bloqueantes, as demais 🟡 com recomendação) + 10 pontos a checar empiricamente |
| [anexos/](anexos/) | Os 4 relatórios completos (A toolkits · B práticas · C pi-hermes-memory · D Obsidian/OneDrive), com todas as fontes e o que ficou "não verificado" |

## Próximos passos

1. **Decidir as 3 questões de processo:** Q-M1 (trilha), Q-M2 (onde ficam os docs) e Q-M3 (agente principal).
2. **Criar a pasta do projeto fora do OneDrive** (ex.: `D:\Projects\pi-obsidian-memory`, com git) e mover este estudo para `docs/research/`.
3. **Sessão nova, kickoff** com o prompt revisado de [05 §2.6](05-proposta-reaproveitamento.md#26-prompt-de-kickoff-revisado-versão-do-seu-prompt-original). O agente entrevista você usando o [06](06-perguntas-abertas.md) como roteiro e propõe visão, requisitos, arquitetura e roadmap para sua aprovação.
