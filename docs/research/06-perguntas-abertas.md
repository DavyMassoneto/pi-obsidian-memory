# 06 — Perguntas abertas e pontos a checar (roteiro da fase F0)

> Este é o roteiro para o `/entrevista` da fase de descoberta. Quando o projeto existir, ele vira `docs/OPEN-QUESTIONS.md`.
> Legenda:
> - 🔴 **bloqueia** a aprovação dos requisitos;
> - 🟡 dá para aceitar a recomendação (★) e revisar depois.
>
> Atalho: responda as 🔴 e diga "aceito as ★ das 🟡".

## M — Processo

| ID | Pergunta | Por que importa | Opções (★ recomendação) | |
|---|---|---|---|---|
| Q-M1 | Qual trilha de metodologia? | Define os comandos e a estrutura de docs | **A ★ OpenSpec + camada de projeto + gate nosso** · B Spec Kit · C Superpowers · D kit 100% nosso ([05 §1.1](05-proposta-reaproveitamento.md#11-trilhas-possíveis-decisão-q-m1)) | 🔴 |
| Q-M2 | Onde vivem os docs do projeto? | Precisam ser versionados junto do código e ficar acessíveis ao agente | **★ `docs/` no repositório** (com nota-link no vault, se quiser) · dentro do vault | 🔴 |
| Q-M3 | Qual agente implementa? | Afeta prompts, hooks e gates | **★ pi** (é o host do pacote) · Claude Code · os dois alternando | 🔴 |
| Q-M4 | Nome, pasta e licença do projeto | O `.git` **não pode** ficar no OneDrive (corrompe) | Nome provisório `pi-obsidian-memory`; **★ pasta `D:\Projects\…`** (fora do OneDrive); **★ MIT** (compatível com a base) | 🟡 |

## Estratégia

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-01 | Como reaproveitar o pi-hermes-memory? | Define o esforço e a relação com o upstream | **★ pacote novo reusando módulos** · fork com refactor · contribuir upstream ([03](03-pi-hermes-memory-anatomia.md#três-caminhos-de-reaproveitamento)) | 🔴 |
| Q-02 | Qual formato no vault? | É a decisão mais cara de reverter, porque dita o formato dos dados | **★ nativo Obsidian** (índice + 1 nota por memória + frontmatter + daily log) · manter `MEMORY.md` com `§` | 🔴 |
| Q-03 | Você já usa o pi-hermes-memory hoje (tem memórias salvas)? | Define se precisamos de import/migração | sim / não | 🔴 |

## A — Escopo

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-A1 | Quais hosts na v1? | Escopo da v1 | **★ só pi, com core agnóstico** · pi + Claude Code já na v1 | 🔴 |
| Q-A2 | Que tipos de memória existem? | Viram o `type` do frontmatter, as pastas e a busca | Proposta: `user`, `feedback` (preferências/correções), `project`, `decision`, `reference`, `lesson` (falhas), daily log. Acrescentar ou remover? | 🔴 |
| Q-A3 | "Sem limite" quer dizer armazenamento ilimitado **e** orçamento de injeção configurável? | O limite real hoje é o que chega ao modelo ([03](03-pi-hermes-memory-anatomia.md#o-limite-dele-o-que-é-de-fato)) | **★ sim** · outra interpretação | 🟡 |
| Q-A4 | Importar as memórias existentes do pi-hermes-memory? | Continuidade | **★ comando `/memory-import`** (lê `~/.pi/agent/pi-hermes-memory`) · não | 🟡 |

## B — Vaults e organização

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-B1 | Um vault ou vários? | Roteamento e config | **★ 1 vault + pasta raiz na v1**, com multi-vault previsto na config (roteamento por projeto) · vários desde a v1 | 🔴 |
| Q-B2 | Nome da pasta raiz no vault | Organização | **★ `Agent Memory/`** · outro | 🟡 |
| Q-B3 | O agente pode **ler** notas suas fora da pasta de memória? | Privacidade e ruído na busca | **★ não na v1** · só leitura de pastas numa lista permitida · sim | 🔴 |
| Q-B4 | O agente pode **escrever** fora da pasta de memória? | Risco às suas notas | **★ nunca** | 🔴 |
| Q-B5 | Campos do frontmatter ([04](04-memoria-obsidian-onedrive.md#esboço-de-layout-dentro-do-vault-para-discussão)) | Busca, dashboard e conflitos | **★ proposta do 04** (`id`, `type`, `description`, `tags`, `project`, `created`, `modified`, `device`, `pinned`, `source`) | 🟡 |
| Q-B6 | Linkar memórias entre si e às notas do projeto com `[[wikilinks]]`? | Grafo no Obsidian | **★ sim, dentro da pasta de memória** · também para suas notas | 🟡 |
| Q-B7 | Idioma das memórias | Tokenizer, stop-words, embeddings | **★ pt-BR** (busca sem acento) · misto pt/en | 🟡 |

## C — Recuperação e injeção

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-C1 | O que entra **automaticamente** no prompt? | Custo, cache e qualidade | **★ `USER.md` + índice + `pinned` + daily log de hoje/ontem (com orçamento) + busca sob demanda** · só a policy, como hoje · tudo | 🔴 |
| Q-C2 | Orçamento de injeção padrão | Custo por sessão | **★ ~3k tokens, configurável** | 🟡 |
| Q-C3 | Busca na v1 | Complexidade × qualidade | **★ FTS5 lexical pt-BR na v1**; vetores multilíngues locais na v2 · vetores já na v1 · API remota | 🟡 |
| Q-C4 | Onde ficam índice, locks e config de máquina | **Fora do OneDrive, sempre** | **★ `~/.pi/agent/<pacote>/`** (convenção do pi) · `%LOCALAPPDATA%\<pacote>\` | 🟡 |
| Q-C5 | Manter `session_search` (busca no histórico de sessões do pi)? | Útil, mas é outro índice | **★ sim, índice local** · não na v1 | 🟡 |

## D — OneDrive e segurança dos dados

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-D1 | O onboarding pode **fixar** a pasta de memória ("Sempre manter neste dispositivo", `attrib +P`)? | Evita placeholders, que já causaram perda de dados (claude-code#62140) | **★ sim, com sua confirmação**, revalidando a cada início · não, só avisar | 🔴 |
| Q-D2 | Quantos dispositivos vão escrever na memória? | Estratégia de conflito | 1 PC · **2+ PCs → ★ daily log por dispositivo + consolidação num único dispositivo** | 🔴 |
| Q-D3 | Política de exclusão | Nada pode sumir sem rastro | **★ nunca apagar: mover para `archive/`** | 🔴 |
| Q-D4 | Backup e versionamento das memórias | Recuperação | **★ histórico de versões do OneDrive + export sob demanda** · git numa cópia fora do OneDrive | 🟡 |
| Q-D5 | Segredos detectados na escrita | Segurança | **★ bloquear**, como hoje · mascarar e salvar | 🟡 |
| Q-D6 | Você usa **outro sync** no mesmo vault (Obsidian Sync, git, Syncthing)? | Dois syncs no mesmo vault geram conflitos | resposta livre | 🔴 |
| Q-D7 | Há plugins do Obsidian que reescrevem arquivos em background (Linter, Templater, "update modified")? | Loops de "modified externally" e conflitos com as escritas do agente | resposta livre | 🟡 |

## E — Integração com o app Obsidian

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-E1 | Usar o Obsidian CLI (exige o app aberto)? | Renames que atualizam links, backlinks | **★ opcional na v2** · na v1 · nunca | 🟡 |
| Q-E2 | Renomear ou mover memórias? | Rename externo quebra links | **★ evitar: `id` estável + `aliases`** | 🟡 |
| Q-E3 | Gerar um dashboard `.base` das memórias no onboarding? | Visibilidade | **★ sim, opcional** | 🟡 |

## F — Configuração e onboarding

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-F1 | Onde fica a configuração? | Caminhos mudam de PC para PC; preferências valem para todos | **★ config de máquina local + preferências opcionais no vault** · só local · só no vault | 🔴 |
| Q-F2 | Como é o onboarding? | É requisito seu | **★ `/memory-setup` interativo** (aviso na 1ª sessão sem config), re-executável, com modo não interativo por env/flags | 🔴 |
| Q-F3 | Auto-detectar vaults e o OneDrive? | Menos digitação e menos erro | **★ sim, só leitura** (`%APPDATA%\obsidian\obsidian.json` + variáveis de ambiente e registro do OneDrive) | 🟡 |
| Q-F4 | Quais opções expor na v1? | Superfície de config | Proposta: vault, pasta, tipos, modo de injeção + orçamento, nível de busca, pin do OneDrive, dispositivo, review (liga/desliga, frequência), consolidação, scanner, idioma, prompts customizáveis | 🔴 |
| Q-F5 | `/memory-doctor` na v1? | Diagnostica placeholders, pin, conflitos e caminhos | **★ sim** | 🟡 |

## G — Comportamento automático

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-G1 | Review em background (salvar sozinho) | Custo de tokens × memória rica | **★ manter** (a cada 10 turnos / 15 tools, só as mensagens recentes) · mais raro · desligado por padrão | 🟡 |
| Q-G2 | Flush antes da compactação | Não perder o que a compactação descartaria | **★ sim** | 🟡 |
| Q-G3 | Consolidação e deduplicação | Memória ilimitada cresce sem freio | **★ automática, mas como propostas em `inbox/` para você aprovar** · totalmente automática · manual | 🔴 |
| Q-G4 | Como identificar o "projeto" | Rotear a memória de projeto | **★ raiz do git** (como hoje) · nome configurável · mapa pasta → projeto | 🟡 |
| Q-G5 | Skills (`skill_manage`) e regras fixas (`STANDING`) vão para o vault? | O pi descobre skills por pasta | **★ skills no vault** (`Agent Memory/skills/`), regras fixas locais · tudo local · sem skills na v1 | 🟡 |
| Q-G6 | Detector de correções em pt-BR | Hoje os padrões são só em inglês | **★ sim, com padrões configuráveis** | 🟡 |

## H — Engenharia

| ID | Pergunta | Por que importa | Opções (★) | |
|---|---|---|---|---|
| Q-H1 | Versão mínima do Node | `node:sqlite` evita build nativo | **★ ≥ 22.13** (idealmente 24 LTS) | 🟡 |
| Q-H2 | Testes | Rede de segurança | **★ vitest + vault temporário + CI no Windows** | 🟡 |
| Q-H3 | Distribuição | Instalação | **★ npm + `pi install npm:<pacote>`** | 🟡 |
| Q-H4 | Plataformas | Escopo de testes | **★ Windows primeiro, core multiplataforma** | 🟡 |
| Q-H5 | Logs e telemetria | Privacidade | **★ logs locais, sem telemetria** | 🟡 |

---

## Pontos a checar antes do código (spikes da F0, só com autorização)

Coisas que a pesquisa **não conseguiu confirmar** e que mudam decisões:

| # | Ponto | Como checar | Afeta |
|---|---|---|---|
| P-1 | `attrib +P` numa pasta faz os arquivos **novos** herdarem o pin? O OneDrive desfaz o pin depois de updates? | Pasta de teste no OneDrive; criar arquivos; `attrib` | Q-D1 |
| P-2 | `.tmp` + `rename` preserva o **histórico de versões** do OneDrive? | Gravar 3 versões via rename; conferir o histórico na web | Q-D4, VaultBackend |
| P-3 | A heurística `stat.blocks === 0` detecta placeholder sem falso positivo em arquivo minúsculo? | Liberar espaço de arquivos de teste de tamanhos variados; `fs.stat` | VaultBackend |
| P-4 | Frequência real de `EPERM`/`EBUSY` no rename com OneDrive + Defender | Loop de 1.000 escritas | Retry/backoff |
| P-5 | O formato do seu `%APPDATA%\obsidian\obsidian.json` bate com o esperado? | Leitura (só leitura) | Q-F3 |
| P-6 | Como o Obsidian reage a uma nota aberta alterada por fora (merge e cursor)? | Editar com o app aberto | Q-D7 |
| P-7 | Os pontos de corte do pi-hermes-memory batem com o anexo C (e o bug `split('/')` no Windows existe)? | Ler o código localmente (clone só leitura) e rodar os testes | Q-01 |
| P-8 | Prompt templates com `$ARGUMENTS` funcionam igual no pi e no Claude Code? | Criar `/entrevista` e testar nos dois | Q-M1 |
| P-9 | `@~/.pi/agent/AGENTS.md` dentro de `~/.claude/CLAUDE.md` importa as regras globais? | Testar no Claude Code | Camada global |
| P-10 | `ctx.reload()` aplica a config nova sem reiniciar o pi? | Extensão mínima de teste | Q-F2 |
