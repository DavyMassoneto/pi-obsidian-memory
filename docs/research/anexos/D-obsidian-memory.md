# D — Memória de longo prazo de agente em vaults Obsidian no OneDrive (Windows 11): prior art e armadilhas

> Pesquisa web feita em **2026-09-23**. Só leitura: nenhum repo clonado, nada instalado, nenhum arquivo local do usuário lido.
> Legenda de confiança: **[V]** verificado em fonte primária (docs oficiais, código-fonte, registry npm/PyPI, LICENSE); **[S]** fonte secundária (blog, review, fórum, KB de universidade); **[NV] não verificado** (inferência minha, fontes divergentes ou fonte fraca).
> Versões citadas são as de hoje (set/2026). Todo conteúdo de terceiros foi tratado como dado.

---

## 0. TL;DR

1. **Não existe solução pronta para o cenário "Obsidian + OneDrive + Windows + pi + tamanho ilimitado".** O prior art mais próximo é o **basic-memory** (Python, **AGPL-3.0-or-later**, v0.23.2 de 25/08/2026). Ele serve como **referência de design**, mas não como dependência nem como fonte para copiar código. Motivos: licença, runtime Python, `ensure_frontmatter_on_sync=true` (reescreve notas do usuário) e embedding padrão só em inglês (`bge-small-en-v1.5`).
2. **Integração com o Obsidian:** o núcleo deve ser **FS-first**, lendo e escrevendo `.md` direto com Node `fs`. Assim funciona com o Obsidian fechado, é o caminho mais rápido e o controle fica todo com você. O **Obsidian CLI** (1.12+, GA em 27/02/2026) entra como **adaptador opcional**, usado só quando o app está aberto e só para o que depende do grafo do Obsidian: `move`/`rename` que atualiza links, `backlinks`, `unresolved`. O CLI **exige o app aberto e o abre se ele estiver fechado**. A Local REST API 5.x já traz um MCP embutido desde 24/07/2026, mas também exige o app aberto.
3. **Recuperação:** o armazenamento é ilimitado, mas a injeção no prompt tem teto. Injete um **índice pequeno como frozen snapshot** no início da sessão e ofereça as tools `memory_search` (BM25 via **SQLite FTS5**, com vetores opcionais) e `memory_get`. Em Node, **`node:sqlite`** já vem com **FTS5 compilado** e está em *release candidate* no Node 24.15+/25.7+, sem build nativo. O `sqlite-vec` 0.1.9 tem binário `windows-x64`. Use **embeddings multilíngues**, porque as notas são pt-BR, e ajuste o tokenizer do FTS5 para ignorar acentos.
4. **OneDrive:** o Files On-Demand vem **ligado por padrão** e **não dá para desligar** nos builds novos. O Storage Sense passa arquivos para online-only depois de **30 dias** sem abrir (padrão do Win11 22H2+, quando o Storage Sense está ligado). Por isso:
   - **fixe** ("pin") a pasta de memória;
   - **detecte placeholders** (`stat.blocks === 0 && size > 0`);
   - **nunca** coloque SQLite, WAL ou `.git` dentro do OneDrive;
   - use temporários `*.tmp` (o OneDrive não sincroniza `.tmp`) e `rename` com retry em `EPERM`/`EBUSY`/`EACCES`;
   - faça escrita com **concorrência otimista** (hash);
   - mantenha **daily logs append-only por dispositivo**;
   - detecte cópias de conflito `Nome-COMPUTADOR.md`;
   - **não renomeie via FS** com o Obsidian aberto, porque os links quebram.

---

## 1. Linha de base: o que existe hoje (Hermes e pi-hermes-memory)

- **Hermes Agent (NousResearch):**
  - Usa `MEMORY.md` com limite de **2.200 chars (~800 tokens)** e `USER.md` com **1.375 chars (~500 tokens)**, ambos em `~/.hermes/memories/`. [V]
  - Os dois são injetados como **frozen snapshot** no início da sessão para preservar o prefix cache. Escritas feitas durante a sessão vão para o disco, mas só aparecem na próxima sessão. [V]
  - Tool `memory` com `add` / `replace` (substring `old_text`) / `remove`. Entradas separadas por `§`. `session_search` sobre SQLite FTS5. [V]
  - Escritas passam por scanner de injection/exfiltration. [V]
- **pi-hermes-memory 0.9.9 (13/09/2026, MIT, chandra447):**
  - Arquivos em `~/.pi/agent/pi-hermes-memory/` (`MEMORY.md`, `USER.md`) e `~/.pi/agent/projects-memory/<project>/`, mais `sessions.db` (FTS5). [V]
  - Limites padrão de **5.000 chars** (MEMORY, USER e projeto) e instruções fixas de 2.000 chars / 20 entradas. [V]
  - Modo padrão **`policy-only`**: não injeta tudo, e o agente chama `memory_search`. O modo `legacy-inject` injeta tudo. [V]
  - Tools: `memory_add` / `memory_replace` / `memory_remove` / `memory_search` / `session_search` / `skill_manage`. [V]
  - Revisão em background a cada 10 turnos ou 15 tool calls. Detecção de correções. **Auto-consolidação** quando o limite enche. [V]
  - Scanner que bloqueia API keys, tokens e SSH keys. [V]
- **O que manter no projeto novo:**
  - frozen snapshot (cache);
  - scanner de segurança nas escritas, agora ainda mais importante porque o vault é editável por humanos e sincronizado de outros dispositivos;
  - revisão periódica;
  - `policy-only` como padrão.
- **O que muda:** os limites de tamanho deixam de valer para o armazenamento e passam a valer só para o **budget de injeção**.
- **Hooks do pi úteis:** `before_agent_start` para injetar seções do system prompt, `session_before_compact` e `session_compact` para o flush pré-compaction, `turn_end`, `session_shutdown` e `pi.registerTool()`. [V, pi.dev/docs/latest/extensions]

---

## 2. basic-memory (basicmachines-co/basic-memory): deep dive

### 2.1 Identidade, versão e licença
- **Versão mais recente: 0.23.2 (25/08/2026).** Antes dela: 0.23.1 (25/08), 0.23.0 (24/08), 0.22.1 (13/06), 0.22.0 (11/06), 0.21.6 (05/06), 0.21.5 (26/05). [V, PyPI]
- **Licença:** arquivo LICENSE = **GNU AGPL v3 (19/11/2007)**; `pyproject` declara `AGPL-3.0-or-later`. Não há exceção nem dual-licensing no LICENSE. [V]
- Python **>=3.12**. Instalação: `uv tool install basic-memory` (o README menciona `--prerelease=allow`). [V]
- Existe uma oferta paga, **Basic Memory Cloud** (US$ 15/mês beta, com sync bidirecional via rclone), mas ela não é necessária. [V/S]

**Implicação da AGPL:**
- Copiar ou adaptar código do basic-memory para o seu pacote TypeScript cria uma obra derivada sob AGPL: o pacote inteiro precisaria sair sob AGPL e, em uso via rede, com oferta de código-fonte.
- **Ideias, formatos e protocolos não são protegidos por copyright:** a sintaxe de observations/relations, os URIs `memory://` e o conceito de permalink podem ser reimplementados em *clean room*.
- Rodá-lo como **processo separado** (servidor MCP) sem modificá-lo não "contamina" o seu código. [NV — isto não é aconselhamento jurídico]

### 2.2 Arquitetura [V, salvo marcação]
- **Arquivos Markdown são a fonte da verdade.** O índice é derivado, em **SQLite** (padrão) ou **Postgres**.
- Dependências-chave: `sqlalchemy`, `aiosqlite`, `alembic`, `asyncpg`, `sqlite-vec>=0.1.6`, `fastembed>=0.7.4`, `watchfiles>=1.0.4`, `markdown-it-py`, `python-frontmatter`, `mcp>=2,<3`, `fastmcp==4.0.3`, `fastapi`, `litellm`. `uvloop` só fora do Windows.
- **Busca:**
  - FTS5 (tabela `search_index` com tokenizer custom, segundo análise de terceiros [S]).
  - **Vetores via sqlite-vec + FastEmbed**, com modelo padrão `bge-small-en-v1.5` (**384 dims**, só inglês).
  - Busca **híbrida** por *score-based fusion*. Se o texto não retorna nada, o modo híbrido refaz a consulta como *relaxed any-word*.
  - Reranker opcional (`jinaai/jina-reranker-v1-tiny-en`, desligado por padrão).
- **Semântica ligada por padrão:** as docs dizem "enabled by default". O `config_models` usa "default factory based on dependency availability". O README lista `BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED (default: false)`, o que diverge. Na prática, fica ligada se `fastembed` e `sqlite-vec` carregarem. [NV quanto à divergência]
- **Chunking:**
  - cada header gera um chunk de seção;
  - **cada observation e cada relation é indexada individualmente**;
  - prosa em blocos de ~900 chars com overlap de ~120.
- Primeiro índice de algumas centenas de notas leva 1–3 min.
- **Sync e watch:**
  - `WatchService` + `SyncService`; mudança detectada em ~1 s;
  - `index_delay` padrão **1000 ms**, `index_batch_size` 32;
  - checksum para detectar edição externa;
  - estado `file_write_status` (pending/writing/synced/failed/external_change_detected) [S];
  - a tool `edit_note` aceita **`expected_checksum`**, que é concorrência otimista.
- **Ignore:** `~/.basic-memory/.bmignore` (global) + `.gitignore` do projeto. Sem `.gitignore`, usa defaults (`.git`, `node_modules`, `.env`…). Houve bug com padrões iniciados em `#` (issue #1539, corrigido no PR #1540).

### 2.3 Formato de nota [V]
```markdown
---
title: Authentication Design
type: note
tags: [auth, security, backend]
permalink: authentication-design
created: 2026-08-01T14:30:00Z
modified: 2026-08-10T09:15:00Z
---
# Authentication Design

## Observations
- [decision] Using JWT tokens for stateless authentication #security
- [approach] Refresh tokens stored in HTTP-only cookies
- [constraint] Tokens expire after 15 minutes (security audit)

## Relations
- implements [[API Security Requirements]]
- depends_on [[User Database Schema]]
- relates_to [[Session Management]]
```
- **Observation:** `- [category] content #tag (context)`. Categorias são livres. Checkboxes `[ ]`/`[x]` não contam como categoria.
- **Relation:** `- relation_type [[Target]]`. `[[Target]]` solto na prosa vira `links_to`. Relações podem apontar para notas que ainda não existem (forward refs).
- **Permalink:** identificador estável, derivado do path (com prefixo do projeto por padrão), que **não muda em rename/move**. É endereçável como `memory://permalink`.

### 2.4 MCP tools [V]
- **Conteúdo:**
  - `write_note` (`title`, `content`, `directory`, `tags`, `note_type`, `metadata`, `overwrite`);
  - `read_note` (`identifier`, paginação);
  - `edit_note` (`operation`: `append | prepend | find_replace | replace_section | insert_before_section | insert_after_section`, `expected_replacements`, `expected_checksum`);
  - `move_note`, `delete_note`, `read_content`, `view_note`.
- **Busca e contexto:**
  - `search_notes` (`search_type`: `text | title | permalink | vector | semantic | hybrid`, filtros `note_types`, `categories`, `tags`, `after_date`, `metadata_filters`, `min_similarity`);
  - `build_context` (`url` memory://, `depth`, `timeframe`, `max_related`);
  - `recent_activity`, `list_directory`.
- **Projetos:** `list_memory_projects`, `create_memory_project`, `delete_project`, `list_workspaces`.
- **Schema:** `schema_infer`, `schema_validate`, `schema_diff`.
- **Diagnóstico e compatibilidade:** `basic_memory_diagnostics`; `search` e `fetch` para compatibilidade com ChatGPT.
- Análise de terceiros cita ~25 tools e lembra que uma superfície grande pesa cognitivamente para o agente. [S]

### 2.5 Configuração [V]
- **Arquivo:** `~/.basic-memory/config.json`, com `projects: {name: {path, mode: local|cloud, …}}` e `default_project`.
- **Env vars:**
  - `BASIC_MEMORY_CONFIG_DIR` muda a pasta de config **e do SQLite padrão**;
  - `BASIC_MEMORY_MCP_PROJECT` trava em um projeto;
  - qualquer `BASIC_MEMORY_*` tem precedência sobre o arquivo.
- **Chaves que mexem nos arquivos do usuário (atenção num vault Obsidian existente):**

  | Chave | Padrão | Efeito |
  |---|---|---|
  | `ensure_frontmatter_on_sync` | **true** | adiciona frontmatter ao sincronizar |
  | `update_permalinks_on_move` | false | — |
  | `kebab_filenames` | false | — |
  | `format_on_save` | false | — |
  | `permalinks_include_project` | true | — |

- Outras chaves úteis como referência:
  - `semantic_embedding_provider` (padrão `fastembed`), `semantic_embedding_model`, prefixes de query/document;
  - `semantic_vector_k=100`, `semantic_min_similarity=0.55`;
  - `sqlite_synchronous=NORMAL`, `sqlite_mmap_size=256MiB`, `sqlite_wal_autocheckpoint=1000`;
  - `watch_project_reload_interval=300`;
  - `auto_update=true`.

### 2.6 Como mapeia num vault Obsidian [V]
- Setup: `basic-memory project add main ~/caminho/do/vault` + `basic-memory project default main`. Nenhum plugin do Obsidian é necessário.
- Notas escritas pela IA aparecem no Obsidian e ficam no grafo por serem wikilinks.
- Dicas oficiais: usar `[[Note Title]]` e `#tag` sem espaços.
- **Riscos para o seu caso:** [NV — inferido da config]
  - o sync pode **adicionar frontmatter a notas pessoais** que não têm;
  - o SQLite fica em `~/.basic-memory` por padrão, portanto **fora** do OneDrive (bom);
  - se o `BASIC_MEMORY_CONFIG_DIR` apontar para dentro do OneDrive, vira um desastre (ver §6.6).

### 2.7 O que pegar emprestado (em clean room) e o que evitar
- **Pegar:**
  - arquivos como verdade + índice derivado e reconstruível;
  - **identidade estável separada do nome do arquivo** (permalink ou `id` em frontmatter);
  - observations como fatos atômicos indexados individualmente (ótimo para recall);
  - relations tipadas em wikilink (compatíveis com o Obsidian);
  - `build_context` com `depth` e `timeframe`;
  - `expected_checksum`;
  - `.gitignore`-style ignore;
  - chunking por seção.
- **Evitar:**
  - superfície de ~25 tools (prefira 3–5);
  - reescrever notas fora da pasta de memória;
  - embedding só em inglês;
  - ausência de ciclo de vida: a análise de terceiros não encontrou decay, consolidação nem pruning. [S]

---

## 3. Opções de integração com Obsidian (2026)

Estado do Obsidian hoje:
- **Desktop 1.14.2 (15/09/2026)** [V].
- 1.13.4 (30/07/2026) introduziu **confirmação para ações de Obsidian URI**, o que torna `obsidian://` ruim para automação silenciosa [V].
- O Obsidian é **gratuito inclusive para uso comercial desde 20/02/2025** [V].
- O Obsidian **ainda não tem servidor MCP first-party** [S].

### 3.1 (a) Filesystem direto
- **App aberto?** Não.
- **Metadata cache, backlinks, links:** nada vem pronto; você mesmo faz o parse de wikilinks, frontmatter e tags. Em compensação, o índice fica sob seu controle.
- **Rename:** um rename externo aparece para o Obsidian como **create + delete**. O evento de rename não dispara e **os links não são atualizados**. A opção "Automatically update internal links" só vale para renames feitos no app. [S, fórum Obsidian]
- **Mudanças externas:** o Obsidian "automatically refreshes your vault to keep up with any external changes" [V, help data-storage]. Se a nota está aberta no editor, aparece "has been modified externally, merging changes automatically" [S, fórum fev/2026].
- **Velocidade e Windows:** é a opção mais rápida e não depende de IPC. Os riscos são placeholders do OneDrive e `EPERM` no rename (§6).
- **Lição dos MCPs de FS:** o **mcpvault** teve vulnerabilidade HIGH de *blocklist case-insensitive bypass* e brechas no filtro de dotfiles em macOS/Windows, corrigida na v0.14.1+ [S]. No Windows, **compare caminhos case-insensitive** e canonicalize com `realpath`.

### 3.2 (b) Local REST API e servidores MCP
- **coddingtonbear/obsidian-local-rest-api (MIT, ~2,9k★):**
  - Versões: **5.2.0 (21/09/2026)**; **5.0.0 (24/07/2026)** reescreveu o engine de patch e **adicionou MCP embutido** em `https://127.0.0.1:27124/mcp/` (Streamable HTTP, `Authorization: Bearer <api-key>`). A 5.0.2 baixou o mínimo para Obsidian **1.8.7**. [V]
  - Portas: HTTPS **27124** e HTTP **27123** (opcional, desligado).
  - Usa CA própria, com certificado restrito a 127.0.0.1/localhost. A 5.2.0 separou CA e leaf para corrigir o Firefox. [V]
  - Endpoints: `/vault/{path}` (CRUD), `/active/`, `/periodic/`, `/search/simple/` (fuzzy), `POST /search/` com **JsonLogic** (`application/vnd.olrapi.jsonlogic+json`), `/commands/`, `/tags/`, `/open/{path}`.
  - **PATCH cirúrgico** por `heading` / `block` / `frontmatter`.
  - Tools MCP: `vault_list`, `vault_read`, `vault_write`, `vault_patch`, `search_query`, `command_execute`, `tag_list`. Tem signed URLs para binários. [V]
  - Suporte a Dataview DQL no `/search/`: [NV na v5; não aparece no README atual].
  - **Obsidian precisa estar rodando.** [V]
- **MarkusPfundstein/mcp-obsidian (MIT, ~4,4k★, Python ≥3.11):**
  - Wrapper da REST API, instalado com `uvx mcp-obsidian`.
  - Tools: `list_files_in_vault`, `list_files_in_dir`, `get_file_contents`, `search`, `patch_content`, `append_content`, `delete_file`.
  - Env: `OBSIDIAN_API_KEY`, `OBSIDIAN_HOST`, `OBSIDIAN_PORT`. [V]
  - Um review de ago/2026 diz que o mantenedor voltou depois de 17 meses mas não publicou release nova. [S]
- **cyanheads/obsidian-mcp-server v3.5.5 (Apache-2.0, TypeScript):**
  - Exige a REST API **v4.0.0–5.x**. Runtime Bun ≥1.4 ou **Node ≥24**. Transportes stdio e Streamable HTTP.
  - 14 tools, entre elas `obsidian_search_notes` (texto / JSONLogic / BM25 via Omnisearch), `obsidian_patch_note`, `obsidian_manage_frontmatter` e `obsidian_manage_tags`.
  - Controle de acesso por `OBSIDIAN_READ_PATHS`, `OBSIDIAN_WRITE_PATHS` e `OBSIDIAN_READ_ONLY`. [V]
- **bitbonsai/mcpvault (`@bitbonsai/mcpvault`, MIT, Node ≥20, ~1,7k★):**
  - **Filesystem direto, sem plugin.** 18 tools, incluindo `patch_note`, `get_note_outline`, `read_note_lines`, `update_frontmatter` (AST-aware, preserva a formatação do YAML) e `wiki_link`.
  - Busca multi-word com **rerank BM25**.
  - Exclui `.obsidian`, `.git`, `node_modules` e dotfiles. Whitelist `.md/.markdown/.txt/.base/.canvas`. Tem modo `--read-only`. [V]
- **aaronsb/obsidian-mcp-plugin (MIT, ~460★):**
  - **É o próprio plugin** e serve MCP em HTTP **3001** / HTTPS **3443**.
  - 8 tools "semânticas": vault, edit, view, graph traversal, workflow, Dataview DQL, Bases, system.
  - App aberto: sim. [V]
  - Distribuição: o README cita BRAT + diretório oficial; um review diz "beta-only via BRAT". [fontes divergentes]
- **Arquivados ou mortos:** `jacksteamdev/obsidian-mcp-tools` (arquivado, com bug de corrupção em headings aninhados), `StevenStavrakis/obsidian-mcp` (dormente desde jun/2025) e a variante Smithery (404). [S, chatforest ago/2026]

### 3.3 (c) Obsidian CLI oficial
- **Lançamento:** early access em 1.12.0 (10/02/2026, exigia Catalyst); **GA em 1.12.4 (27/02/2026)**. A doc diz "Using the CLI requires the Obsidian 1.12 installer". No Windows, o redirecionador **`Obsidian.com`** só é instalado com o **installer 1.12.7+**. O auto-update do app não troca o installer: quem tem installer antigo precisa reinstalar. [V]
- **Ativação:** Settings → General → **Command line interface**, depois registrar.
  - Windows: `Obsidian.com` fica ao lado do `Obsidian.exe` e o CLI é adicionado ao PATH (reinicie o terminal).
  - macOS: symlink em `/usr/local/bin/obsidian`.
  - Linux: `~/.local/bin/obsidian`. [V]
- **App precisa estar aberto:** "Obsidian CLI requires the Obsidian app to be running. If Obsidian is not running, the first command you run launches Obsidian." [V] Para um agente de terminal, isso significa **abrir a GUI de surpresa**.
- **Sintaxe:** `obsidian [vault=<nome|id>] <comando> chave=valor flags`.
  - Com `file=<nome>` a resolução é igual à de wikilink; com `path=<pasta/nota.md>` o caminho é exato.
  - `\n` e `\t` funcionam em `content=`.
  - Várias listas aceitam `format=json|csv|tsv`, e `--copy` copia o resultado.
  - Sem argumentos, `obsidian` abre um TUI. [V]
- **Comandos principais:** [V/S]
  - arquivos: `read`, `create` (`overwrite`, `open`), `append`, `prepend` (depois do frontmatter), **`move` / `rename` (atualizam wikilinks)**, `delete`, `files`, `folders`, `file`, `vault`, `vaults`;
  - busca e links: `search`, `search:context` (saída grep-like `path:line: text`), `backlinks`, `links`, `unresolved`, `orphans`, `deadends`;
  - tags, tarefas e propriedades: `tags`, `tag`, `tasks`, `properties`, `property:read`, `property:set`, `property:remove`;
  - daily notes: `daily`, `daily:path`, `daily:read`, `daily:append`, `daily:prepend`;
  - Bases: `bases`, `base:query` (`format=json|csv|tsv|md|paths`), `base:create`;
  - histórico: `history`, `history:restore`, `diff`;
  - Sync: `sync`, `sync:status`, `sync:history`, `sync:read`, `sync:restore`, `sync:deleted`;
  - comandos e plugins: `commands`, `command`, `plugins`, `plugin:enable`, `plugin:install`;
  - dev: `eval` (roda JS dentro do app, **cuidado de segurança**), `dev:screenshot`, `dev:console`, `dev:dom`.
- **Pegadinhas para agentes:**
  - **exit code sempre 0**: é preciso fazer parse da saída;
  - **~1 s por operação**, sem batch real;
  - alguns comandos "sucedem" sem fazer nada. [S, guia dsebastien]
  - No early access no Windows, rodar o terminal **como Administrador** fazia o CLI **não retornar nada**. [S, zenn.dev; NV se ainda acontece na GA]
- **Obsidian Headless** (npm, open beta, **Node 22+**, fev/2026) sincroniza vaults **só via Obsidian Sync**, sem a GUI. Não serve para OneDrive, mas é útil se um dia migrar. [S]

### 3.4 (d) kepano/obsidian-skills (MIT)
- **Skills:**
  - `obsidian-markdown`: OFM, isto é, wikilinks, embeds `![[...]]`, block IDs `^id`, callouts `> [!note]`, properties (tipos text/list/number/checkbox/date/datetime/tags/aliases/cssclasses), comentários `%%…%%`, highlights `==…==`, math e Mermaid;
  - `obsidian-bases` (arquivos `.base`: views, filters, formulas, summaries);
  - `json-canvas`;
  - `obsidian-cli`;
  - `defuddle` (web → markdown limpo);
  - **`knap`** (templates Markdown a partir de JSON/CSV, adicionada em 10/09/2026).
- Último commit em **15/09/2026**. [V]
- Instalação: skills na pasta `.claude/` do vault (Claude Code), `~/.codex/skills`, OpenCode, marketplace ou `npx skills`. [V]
- A skill `obsidian-cli` diz explicitamente "**Requires Obsidian to be open**" e recomenda as flags `silent` (não abrir arquivo) e `total`. [V]
- Diretriz da skill markdown: "use `[[wikilinks]]` for notes within the vault (Obsidian tracks renames automatically)". [V]
- **Uso sugerido:**
  - empacote ou referencie `obsidian-markdown` no seu pacote pi para o LLM escrever OFM válido;
  - use `obsidian-bases` para gerar um `.base` que funcione como **dashboard de memórias** (filtrar por `type`, `project`, `modified`). Bases é core plugin desde a 1.9.0 (mai/2025). [V]

### 3.5 (e) Busca semântica dentro do Obsidian
- **Smart Connections (brianpetro):**
  - **Licença "Smart Plugins License"**, source-available, com restrição a ofertas concorrentes. **Não é OSI.** [V]
  - Embeddings locais por padrão (v4; a 4.5.0 saiu em 05/05/2026 [S]) gravados em **`.smart-env/` dentro do vault**. A própria doc manda **excluir `.smart-env/` do sync de terceiros**, o que o OneDrive não oferece para contas pessoais (§6.6). [V]
  - **Sem MCP oficial.** [S]
  - MCPs da comunidade que leem `.smart-env/`, por exemplo `msdanyg/smart-connections-mcp` (MIT, Node 20+, transformers.js, bge-micro-v2 384d), funcionam **sem o app aberto** para consulta, mas dependem do plugin para gerar ou atualizar vetores. [S]
- **Omnisearch (GPL-3.0):**
  - Busca BM25 via MiniSearch.
  - **Servidor HTTP opt-in** em `GET http://localhost:51361/search?q=…`, que retorna `score`, `path`, `basename`, `foundWords`, `matches`, `excerpt`.
  - **O servidor para quando o Obsidian fecha.** [V]
- **Conclusão:** para memória de agente, **mantenha a busca semântica no seu próprio índice** (§5). Plugins de busca exigem o app aberto ou gravam dados volumosos dentro do vault sincronizado.

### 3.6 Recomendação de integração
- **Núcleo FS-first** (funciona 100% com o Obsidian fechado) com índice próprio.
- **Adaptador `ObsidianCli` opcional**, habilitado quando `Obsidian.exe` está rodando e o CLI está registrado:
  - `move`/`rename` com atualização de links;
  - `backlinks`, `unresolved` e `orphans` para manutenção;
  - `base:query`.
  - Nunca dispare o CLI quando o app está fechado (ele abre a GUI), a menos que o usuário tenha optado por isso no onboarding.
- **Local REST API/MCP:** só como integração alternativa para quem já usa. Não vale como dependência, por causa de app aberto, certificado e plugin de terceiro.
- **Rename de memórias:** evite. Use `id` estável no frontmatter, `aliases` e wikilinks por título. Se precisar renomear, faça via CLI com o app aberto ou reescreva os links você mesmo com o app fechado.

---

## 4. Outros designs de memória: layout, recuperação e o que pegar emprestado

### 4.1 OpenClaw [V, docs e código de set/2026]
- **Layout** (workspace padrão `~/.openclaw/workspace`):
  ```text
  USER.md            # preferências estáveis (orçamento de injeção pequeno e separado)
  MEMORY.md          # fatos curados de longo prazo / decisões
  memory/YYYY-MM-DD.md  (ou memory/YYYY-MM-DD-<slug>.md)   # daily logs
  DREAMS.md          # diário de consolidação ("dreaming") para revisão
  memory/imports/{codex,claude-code,hermes}/                # memórias migradas
  ```
- **Bootstrap:**
  - num `/new` ou `/reset` limpo, carrega `MEMORY.md`, `USER.md` e **as notas de hoje e de ontem**;
  - se `MEMORY.md` passa do budget, **o arquivo em disco fica intacto e só a cópia injetada é truncada**;
  - notas mais antigas só entram via busca.
- **Tools:** `memory_search` (híbrida) e `memory_get` (arquivo ou faixa de linhas).
- **Índice:**
  - SQLite por agente (docs atuais: `~/.openclaw/agents/<agentId>/agent/openclaw-agent.sqlite`; walkthrough de fev/2026: `~/.openclaw/memory/<agentId>.sqlite`);
  - FTS5 com BM25, trigram para CJK;
  - `sqlite-vec` opcional, com fallback em software;
  - consultas nativas num **processo read-only separado** para não travar o event loop.
- **Constantes** (`src/agents/memory-search.ts`):
  - `DEFAULT_CHUNK_TOKENS=400`, `DEFAULT_CHUNK_OVERLAP=80`;
  - `DEFAULT_MAX_RESULTS=6`, `DEFAULT_MIN_SCORE=0.35`;
  - **`VECTOR_WEIGHT=0.7`, `TEXT_WEIGHT=0.3`, `CANDIDATE_MULTIPLIER=4`**;
  - **`MMR_LAMBDA=0.7`**, **`TEMPORAL_DECAY_HALF_LIFE_DAYS=30`**;
  - `WATCH_DEBOUNCE_MS=1500`, cache de embeddings com 50.000 entradas.
- **Ranking:** score híbrido × recency decay × importance, seguido de **MMR** (Jaccard sobre tokens dos snippets). Até 200 candidatos por perna. `MEMORY.md`, `USER.md` e arquivos não datados são **evergreen** (sem decay). O rank BM25 é normalizado como `1/(1+rank)`. [V/S]
- **Embeddings:** OpenAI `text-embedding-3-small` por padrão, com opção local em GGUF via llama.cpp (ex.: `embeddinggemma-300m-qat-Q8_0.gguf`), Ollama, LM Studio e outros.
- **Pre-compaction memory flush:**
  - turno **silencioso**, ligado por padrão (`agents.defaults.compaction.memoryFlush.enabled`);
  - dispara quando o contexto projetado passa de `contextWindow − reserveFloor − softThresholdTokens` (**4000**). Exemplo da doc: janela de 32.768 com reserva de 8.192 dá 20.576;
  - roda **uma vez por ciclo de compaction**, numa **cópia privada** da conversa;
  - o prompt manda gravar em `memory/YYYY-MM-DD.md` e responder **`NO_REPLY`** se não houver nada;
  - existe `forceFlushTranscriptBytes: "2mb"`.
- **Dreaming:** cron gerenciado com gates de score, recall-frequency e query-diversity, e **taint gating**: conteúdo não confiável nunca é promovido. O resumo vai para `DREAMS.md`.
- **Pegar:**
  - daily log **append-only** + arquivo curado;
  - "hoje + ontem" no bootstrap;
  - fusão ponderada 0.7/0.3 com candidate multiplier;
  - decay de 30 dias com evergreen;
  - MMR 0.7;
  - flush antes da compaction (no pi: `session_before_compact`);
  - consolidação com arquivo de revisão humana;
  - taint gating.

### 4.2 Anthropic memory tool (`memory_20250818`) [V]
- **Client-side:** o modelo pede operações sobre o prefixo virtual **`/memories`** e o seu handler mapeia esse prefixo para armazenamento real (pasta, DB…).
- Declaração: `{"type":"memory_20250818","name":"memory"}`. **Não exige beta header.** Disponível em Claude 4+.
- **Comandos:**
  - `view` (diretório com 2 níveis e tamanhos; arquivo com números de linha; `view_range`; o modelo espera **truncamento acima de 16.000 chars**);
  - `create`;
  - `str_replace` (falha se `old_str` não é único);
  - `insert` (`insert_line`);
  - `delete`;
  - `rename` (não sobrescreve destino).
- **Prompt injetado automaticamente:** "IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE…" / "ASSUME INTERRUPTION".
- **Segurança:** validar *todo* path contra traversal (`../`, `..\`, `%2e%2e%2f`, canonicalização). Recomenda cap de tamanho, paginação e **expiração** de arquivos não acessados.
- Combina com **context editing** e **compaction** server-side.
- **SDK TS:** `betaMemoryTool` e `BetaLocalFilesystemMemoryTool` (em `@anthropic-ai/sdk/tools/memory/node`).
- **Pegar:** implemente um **handler compatível com `memory_20250818`** que mapeia `/memories` para `<vault>/<memoryRoot>`. Com modelos Claude, o comportamento treinado vem de graça. Para outros provedores no pi, exponha o mesmo conjunto de comandos como tool normal.

### 4.3 Claude Code auto-memory [V]
- **Layout:** `~/.claude/projects/<project>/memory/`, com `MEMORY.md` (**índice, uma linha por memória**) e um arquivo por memória (ex.: `user_role.md`, `feedback_testing.md`).
- **Injeção:** só **as primeiras 200 linhas ou 25 KB** do `MEMORY.md` (o que vier primeiro). Os topic files são lidos **sob demanda** com as tools normais de arquivo.
- **Guarda do índice:** perto do limite, o Claude Code pede para enxugar. Acima do limite, a escrita passa, mas volta um erro mandando reescrever o índice.
- **Frontmatter:**
  - campo **`type`**: `user | feedback | project | reference`;
  - o Claude Code grava **`modified`** (ISO 8601) automaticamente desde a v2.1.214 [V];
  - `name` e `description` aparecem na prática [S, harrisonsec abr/2026].
- **Política:** não salvar o que dá para derivar do código ou do git, nem o que já está no CLAUDE.md.
- **Configuração:** `autoMemoryEnabled`, `autoMemoryDirectory` (absoluto ou `~/`), `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. A memória é machine-local.
- **Pegar:**
  - **índice + topic files**;
  - taxonomia `type`;
  - `modified` automático;
  - guarda de tamanho **do índice** (não do armazenamento);
  - política de "não salvar o derivável".
- Note que `autoMemoryDirectory` poderia apontar para o vault. Esse é justamente o cenário OneDrive que exige os cuidados da §6.

### 4.4 Letta [V]
- **Memory blocks:**
  - `label`, `description`, `value`, `limit` (em caracteres), `read_only`;
  - **sempre no contexto**, renderizados em bloco XML-like `<memory_blocks>`;
  - compartilháveis entre agentes;
  - as docs usam 5.000 nos exemplos; o default exato ficou [NV].
- **MemFS / Context Repositories** (Letta Code, post de **12/02/2026**):
  - memória como **Markdown versionado em git**;
  - `system/` **sempre carregado inteiro**; o resto aparece só como **árvore + `description` do frontmatter** (progressive disclosure), e o conteúdo é lido sob demanda;
  - cada edição vira commit;
  - subagentes escrevem em **git worktrees** separados e fazem merge;
  - skills de init, reflection ("sleep-time") e **defrag** (reorganiza em **15–25 arquivos focados**);
  - `/init`, `/remember`, `/doctor`.
- **Sem índice vetorial por padrão:** a busca usa as tools normais. O mod **MemFS Search** faz keyword e usa **qmd** para semântico/híbrido.
- **Letta Filesystem (open_file/grep_file/search_file) está depreciado** em favor de acesso direto ao FS + context repositories + qmd.
- **Pegar:**
  - flag `pinned: true` (o equivalente a `system/`);
  - `description` obrigatória para o progressive disclosure;
  - defrag periódico;
  - reflection em background.
- **Cuidado:** git versioning **dentro do OneDrive é mau negócio** (§6.6).

### 4.5 Cline Memory Bank [V]
- **Layout fixo em `memory-bank/`:**
  - `projectbrief.md` (fundação);
  - `productContext.md`, `systemPatterns.md`, `techContext.md`;
  - `activeContext.md` (muda mais);
  - `progress.md`.
- **Regra:** "I MUST read ALL memory bank files at the start of EVERY task". Comandos "initialize memory bank" e "update memory bank".
- **Pegar:** os templates de **contexto por projeto**, para o onboarding de projeto. **Não** pegar o "ler tudo sempre", que não escala para memória ilimitada.

### 4.6 claude-mem (thedotmack) [V]
- v13.25.3, **Apache-2.0** (LICENSE atual), Node ≥20, `npx claude-mem install`.
- **Captura automática** via hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd) e worker HTTP local com viewer.
- Compressão por IA em **observations** tipadas (`decision | bugfix | feature | refactor | discovery | change`) com title/subtitle/narrative/facts/concepts, mais `session_summaries` (request/investigated/learned/completed/next_steps).
- **Armazenamento:** SQLite (`bun:sqlite`) com **FTS5 + triggers**; Chroma para híbrido. Dados em `~/.claude-mem/`.
- **Progressive disclosure em 3 camadas:** `search` (índice compacto com IDs, ~50–100 tokens por resultado), `timeline` (contexto cronológico) e `get_observations` (detalhe só dos IDs filtrados, ~500–1.000 tokens). Promete ~10x de economia.
- **Pegar:**
  - API de busca em camadas (listar IDs + snippet → timeline → detalhe);
  - tipos de observation;
  - triggers para manter o FTS em sincronia.
- A licença Apache-2.0 permite reaproveitar código com atribuição e NOTICE.

### 4.7 mem0 (contraste: não é Markdown) [V]
- Registros em **vector store**, extraídos por LLM e escopados por `user_id` / `agent_id` / `run_id`.
- **Algoritmo v3** (migration guide): **extração single-pass ADD-only**, sem UPDATE/DELETE no write. Fatos conflitantes **se acumulam**, e o ranking resolve na recuperação qual vale.
- Fatos do agente viram first-class.
- **Entity linking embutido** (spaCy, coleção `{collection}_entities`) substitui o graph store externo.
- Recuperação multi-sinal: **semântico + BM25 + entidade**.
- Benchmarks do próprio vendor: LoCoMo 91,6, LongMemEval 93,4.
- **Pegar:**
  - ADD-only no hot path (log append-only) com resolução por recência/ranking;
  - **entidades** como sinal de ranking (no Obsidian, os próprios **wikilinks, tags e aliases** servem de entidades).

### 4.8 qmd (tobi/qmd), bônus relevante [V]
- `@tobilu/qmd` 2.8.3, **MIT**, **Node ≥22** / Bun.
- Stack: **better-sqlite3 ^13.0.3 + sqlite-vec 0.1.9 + node-llama-cpp 3.20** (GGUF), com EmbeddingGemma 300M, Qwen3-Reranker 0.6B e expansão de query com Qwen3 1.7B.
- Pipeline: **BM25 (FTS5) + vetor → RRF → rerank por LLM**.
- *Collections* com glob, *contexts* descritivos e filtro por frontmatter tipado. MCP com `query`, `get`, `multi_get` e `status`. CLI com saída JSON/CSV/MD/XML.
- No Windows, o README recomenda Vulkan (CUDA paralelo pode crashar). Os modelos somam ~2 GB.
- É o motor que o Letta recomenda para o MemFS.
- **Pegar:** serve de referência de pipeline em TypeScript e até de dependência opcional ("modo avançado"). A licença MIT permite.

### 4.9 Resumo do que pegar emprestado

| Sistema | Layout | Recuperação | Pegar |
|---|---|---|---|
| basic-memory | notas por entidade, observations/relations | FTS5 + sqlite-vec + híbrido; `build_context` em grafo | id estável, observations atômicas, relations tipadas, `expected_checksum` |
| OpenClaw | MEMORY.md + USER.md + daily logs | híbrido 0.7/0.3, decay 30d, MMR 0.7 | hoje+ontem no bootstrap, flush pré-compaction, dreaming com revisão |
| Anthropic memory tool | `/memories` virtual | agente navega (`view`) | handler compatível, anti-traversal, cap e expiração |
| Claude Code | MEMORY.md (índice) + topic files | índice injetado (200 linhas/25 KB) + leitura sob demanda | `type`, `modified`, guarda do índice |
| Letta MemFS | `system/` fixo + árvore com descriptions | FS tools (qmd opcional) | `pinned`, `description`, defrag 15–25 arquivos |
| Cline | 6 arquivos fixos | lê tudo | só os templates de projeto |
| claude-mem | SQLite (não markdown) | search → timeline → get | API em 3 camadas, tipos |
| mem0 | vector DB | semântico + BM25 + entidades | ADD-only + resolução na leitura; entidades |
| qmd | coleções de .md | BM25 + vetor + RRF + rerank | pipeline TS completo (MIT) |

---

## 5. Recuperação para memória Markdown ilimitada

### 5.1 Padrões que funcionam
1. **Armazenamento ilimitado, injeção limitada.**
   - Injete um *frozen snapshot* (Hermes) com: `USER.md`, o índice `MEMORY.md` (uma linha por memória, estilo Claude Code), memórias com `pinned: true` (estilo Letta `system/`) e hoje+ontem do daily log (OpenClaw).
   - Tudo sob um **budget em tokens**, com truncamento e a linha "há N memórias; use memory_search".
2. **Progressive disclosure.**
   - `memory_search` devolve **ID + título + snippet + score**.
   - `memory_get` devolve o arquivo ou uma faixa de linhas.
   - Opcionalmente, `memory_timeline` (claude-mem).
   - Em modelos Claude, o handler `memory_20250818` deixa o modelo navegar sozinho.
3. **Busca lexical primeiro** (FTS5/BM25 ou ripgrep).
   - Memória de coding agent é cheia de identificadores exatos: nomes de pacote, flags, paths, erros. BM25 acerta isso melhor que vetor.
   - Vetores entram como segunda perna. Use fusão ponderada (OpenClaw 0.7/0.3) ou **RRF** (`Σ w/(k+rank)`, k≈60).
4. **Pós-processamento:**
   - **recency decay** (meia-vida de 30 dias, exceto evergreen);
   - **boost por tipo/projeto** (projeto atual > global);
   - **MMR** (λ 0.7) para diversidade;
   - `minScore` (0.35 no OpenClaw) para não injetar lixo.
5. **Escrita ADD-only no hot path** (daily log por dispositivo). A **consolidação** roda fora do hot path:
   - dedup (cosine ≥ ~0,9 ou mesma entidade/wikilink);
   - merge em topic file;
   - atualização do índice;
   - arquivamento (mover para `archive/`, nunca apagar);
   - propostas incertas vão para `inbox/`, para revisão no Obsidian.
6. **Flush pré-compaction** (pi `session_before_compact`): turno silencioso "grave memórias duráveis agora; responda NO_REPLY se nada".
7. **Chunking por heading** (basic-memory: seção; prosa ~900 chars com overlap de 120. OpenClaw: 400 tokens com overlap de 80). Observations como chunks individuais.
8. **Índice derivado e reconstruível.**
   - Chave `(path, size, mtimeMs, sha256)`.
   - Watcher com debounce de 1–1,5 s, mais reconciliação completa no start. Watchers perdem eventos, e o OneDrive grava arquivos vindos de outros devices.

### 5.2 Stack TS/Node no Windows sem sofrimento de build nativo

Contexto do Node:
- **Node 24** é Active LTS até 20/10/2026.
- **Node 26** é Current (desde 05/05/2026) e vira LTS em **28/10/2026**.
- A partir de out/2026 o Node passa a ter uma major por ano. [S]

| Peça | Versão (set/2026) | Nativo? | Windows | Notas |
|---|---|---|---|---|
| **`node:sqlite`** (built-in) | Node ≥22.13 / 23.4 sem flag; **RC** desde 24.15.0 e 25.7.0 | embutido no Node | ✔ zero install | **FTS5 e FTS3 compilados** (`deps/sqlite/sqlite.gyp` define `SQLITE_ENABLE_FTS5`); `allowExtension` + `loadExtension()`; `defensive: true` por padrão (24.14+/25.5+); `serialize()` (26.1+) [V] |
| **better-sqlite3** | **13.0.3** (05/08/2026) | N-API | ✔ | v13 migrou para `node-addon-api`, com **prebuilds dentro do pacote** (sem prebuild-install) e compatibilidade entre versões de Node e Electron; Node ≥22; SQLite 3.53.4 com FTS5 [V] |
| **sqlite-vec** | **0.1.9** (alpha 0.1.10-alpha.4) | extensão | ✔ `sqlite-vec-windows-x64` | pré-v1 ("expect breaking changes"); `vec0` com `distance_metric=cosine`; KNN com `MATCH ? AND k = ?`; Apache-2.0/MIT; carrega em `node:sqlite` (23.5+) ou better-sqlite3 [V] |
| **MiniSearch** | 7.2.0 (MIT) | JS puro | ✔ | BM25-like, fuzzy e prefix; serializa em JSON; índice em RAM [V] |
| **Orama** | 3.1.18 (Apache-2.0) | JS puro | ✔ | full-text + vetor + **híbrido** (`mode: 'hybrid'`); plugin de persistência [V] |
| **FlexSearch** | 0.8.212 (Apache-2.0) | JS puro | ✔ | muito rápido; adapters persistentes [V/NV] |
| **@vscode/ripgrep** | 1.18.0 | binário | ✔ `@vscode/ripgrep-win32-x64` | agora via optionalDependencies por plataforma (sem download no postinstall, segundo o manifesto) [V] |
| **@huggingface/transformers** | **4.3.0** (v4 lançada em 09/02/2026) | usa `onnxruntime-node` 1.30.0 (~287 MB desempacotado; tem postinstall) | ✔ | `env.cacheDir` controla o cache (padrão: `.cache` dentro do pacote); `allowRemoteModels=false` para offline [V] |
| **node-llama-cpp** | 3.21.1 | prebuilt | ✔ `win-x64`, `-cuda`, `-vulkan`, `win-arm64` | GGUF (EmbeddingGemma etc.); tem postinstall [V] |
| **chokidar** | 5.0.0 | JS | ✔ | ESM-only, Node ≥20.19. `fs.watch({recursive:true})` nativo também serve no Windows [V/NV] |

**Recomendação:**
- **`node:sqlite` como padrão**, com fallback para better-sqlite3 13 se precisar suportar Node 22 antigo.
- **FTS5 sempre ligado.**
- **Vetores opcionais** (sqlite-vec + transformers.js ou endpoint remoto).
- **MiniSearch** como fallback puro JS, por exemplo se `loadExtension` falhar.
- O **índice fica em `%LOCALAPPDATA%`**, nunca no OneDrive.

**pt-BR:**
- FTS5: `tokenize = "unicode61 remove_diacritics 2"`. O `2` trata corretamente codepoints compostos; o padrão é `1`. Para busca por substring, crie uma segunda tabela com o tokenizer `trigram` (casa ≥3 chars e acelera LIKE/GLOB se não remover diacríticos). [V, sqlite.org]
- **Embeddings multilíngues:**
  - `Xenova/multilingual-e5-small`: ONNX de `intfloat/multilingual-e5-small`, MIT, 512 tokens, prefixos obrigatórios `query: ` e `passage: `, 384 dims [V/NV dims];
  - `onnx-community/embeddinggemma-300m-ONNX`: 768 dims com MRL para 512/256/128, 100+ línguas, **sem fp16** (use fp32/q8/q4), prefixos `task: search result | query: ` e `title: none | text: `, **licença Gemma**.
  - Evite `bge-small-en-v1.5` (default do basic-memory), que é só inglês.
- Tokenização em JS: use `\p{L}\p{N}` com a flag `u`. `\W` corta palavras acentuadas.

### 5.3 Exemplos (ilustrativos, TypeScript)

**(a) Schema FTS5 com `node:sqlite` (índice fora do OneDrive)**
```ts
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const indexPath = join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "index", `${vaultId}.sqlite`);
const db = new DatabaseSync(indexPath, { allowExtension: true, timeout: 5000 });

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, size INTEGER, mtime_ms INTEGER, sha256 TEXT);
  CREATE TABLE IF NOT EXISTS chunks(
    id INTEGER PRIMARY KEY, path TEXT NOT NULL, heading TEXT, body TEXT NOT NULL,
    type TEXT, project TEXT, mtime_ms INTEGER, evergreen INTEGER DEFAULT 0);
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    heading, body, content='chunks', content_rowid='id',
    tokenize = "unicode61 remove_diacritics 2");
  -- external content: mantenha o FTS em sincronia via triggers
  CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, heading, body) VALUES (new.id, new.heading, new.body); END;
  CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, heading, body) VALUES ('delete', old.id, old.heading, old.body); END;
  CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, heading, body) VALUES ('delete', old.id, old.heading, old.body);
    INSERT INTO chunks_fts(rowid, heading, body) VALUES (new.id, new.heading, new.body); END;
`);

// Sanitize: cada termo entre aspas evita erro de sintaxe FTS5 com '-', ':', etc.
const toFts = (q: string) =>
  q.split(/\s+/).filter(Boolean).map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");

const textSearch = db.prepare(`
  SELECT c.id, c.path, c.heading, c.body, c.mtime_ms AS mtimeMs, c.evergreen,
         bm25(chunks_fts, 2.0, 1.0) AS bm25,                  -- menor = melhor
         snippet(chunks_fts, 1, '«', '»', '…', 16) AS snip
  FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
  WHERE chunks_fts MATCH ? ORDER BY bm25 LIMIT ?`);

const hits = textSearch.all(toFts("decisão sqlite onedrive"), 24);
```

**(b) Vetores com sqlite-vec (opcional)**
```ts
import * as sqliteVec from "sqlite-vec";
sqliteVec.load(db); // node:sqlite exige { allowExtension: true }

db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  embedding float[384] distance_metric=cosine)`);

const f32ToBlob = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength);
db.prepare(`INSERT OR REPLACE INTO chunks_vec(rowid, embedding) VALUES (?, ?)`)
  .run(BigInt(chunkId), f32ToBlob(vec));          // rowid inteiro: use BigInt

const knn = db.prepare(`
  SELECT rowid AS id, distance FROM chunks_vec
  WHERE embedding MATCH ? AND k = ?`).all(f32ToBlob(queryVec), 24);
// cosine distance ∈ [0,2] → similaridade = 1 - distance
```

**(c) Embeddings locais multilíngues (transformers.js v4)**
```ts
import { pipeline, env } from "@huggingface/transformers";
env.cacheDir = join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "models"); // fora do OneDrive
// env.allowRemoteModels = false; // depois do primeiro download, para rodar 100% offline

const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });
export async function embed(texts: string[], kind: "query" | "passage"): Promise<Float32Array[]> {
  const out = await extractor(texts.map((t) => `${kind}: ${t}`), { pooling: "mean", normalize: true });
  return (out.tolist() as number[][]).map((a) => Float32Array.from(a));
}
```

**(d) Fusão híbrida, recency decay e MMR (à la OpenClaw)**
```ts
type Cand = { id: number; path: string; text: string; mtimeMs: number; evergreen: boolean; s: number };

export function fuse(textIds: number[], vecHits: { id: number; distance: number }[],
                     rows: Map<number, Omit<Cand, "s">>, wVec = 0.7, wText = 0.3): Cand[] {
  const acc = new Map<number, number>();
  textIds.forEach((id, rank) => acc.set(id, wText * (1 / (1 + rank))));        // BM25 via rank
  for (const h of vecHits) acc.set(h.id, (acc.get(h.id) ?? 0) + wVec * Math.max(0, 1 - h.distance));
  return [...acc].flatMap(([id, s]) => (rows.has(id) ? [{ ...rows.get(id)!, s }] : []));
}

export const decay = (c: Cand, halfLifeDays = 30, now = Date.now()) =>
  c.evergreen ? 1 : Math.pow(0.5, (now - c.mtimeMs) / 86_400_000 / halfLifeDays);

const toks = (t: string) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean)); // não use \W (quebra "ação")
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1);
};

export function rank(cands: Cand[], k = 6, lambda = 0.7, minScore = 0.35): Cand[] {
  const pool = cands.map((c) => ({ ...c, s: c.s * decay(c) })).filter((c) => c.s >= minScore * 0.5);
  const T = new Map(pool.map((c) => [c.id, toks(c.text)]));
  const picked: Cand[] = [];
  while (picked.length < k && pool.length) {
    let bi = 0, best = -Infinity;
    pool.forEach((c, i) => {
      const red = picked.length ? Math.max(...picked.map((p) => jaccard(T.get(c.id)!, T.get(p.id)!))) : 0;
      const score = lambda * c.s - (1 - lambda) * red;
      if (score > best) { best = score; bi = i; }
    });
    picked.push(pool.splice(bi, 1)[0]);
  }
  return picked;
}
```

**(e) Fallback puro JS (MiniSearch) com remoção de acentos**
```ts
import MiniSearch from "minisearch";
const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const ms = new MiniSearch({
  idField: "id",
  fields: ["title", "body", "tags"],
  storeFields: ["path", "title", "mtimeMs", "type"],
  processTerm: (t) => fold(t),
  searchOptions: { boost: { title: 2 }, prefix: true, fuzzy: 0.2 },
});
ms.addAll(docs);                                 // docs: {id, path, title, body, tags, mtimeMs, type}
const hits = ms.search("decisao arquitetura");   // casa "decisão arquitetura"
const snapshot = JSON.stringify(ms);             // persistir em %LOCALAPPDATA%
// const ms2 = MiniSearch.loadJSON(snapshot, { idField: "id", fields: [...], processTerm: fold });
```

**(f) Chunking por heading (tolerante a CRLF do Windows)**
```ts
export function chunkMarkdown(md: string, max = 1600, overlap = 200) {
  const text = md.replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, ""); // remove frontmatter
  const out: { heading: string; body: string }[] = [];
  for (const sec of text.split(/^(?=#{1,6}\s)/m)) {
    const heading = /^#{1,6}\s+(.*)$/m.exec(sec)?.[1] ?? "";
    for (let i = 0; i < sec.length; i += max - overlap) out.push({ heading, body: sec.slice(i, i + max) });
  }
  return out.filter((c) => c.body.trim());
}
```

---

## 6. OneDrive + Obsidian no Windows: armadilhas e mitigação

### 6.1 Files On-Demand, placeholders e hydration
- **Padrão ligado e sem opção de desligar:** "Starting with OneDrive build 23.066 Files On-Demand is enabled by default for all users". Nos builds novos só dá para escolher entre "Free up disk space" (padrão) e "Download all files". [V, Microsoft Support]
- **Três estados:** [V]

  | Estado | Atributo | Comando |
  |---|---|---|
  | online-only (nuvem azul) | unpinned | `attrib +U` |
  | localmente disponível (check verde) | clearpin | `attrib -P` |
  | **sempre disponível** (círculo verde) | pinned | `attrib +P` |

  Consulta com `attrib <path>`. [V, Microsoft Learn]
- **Hydration:** "Whether you use file system APIs, the Command Prompt, or a desktop or a UWP app to access a placeholder file, the file will hydrate". Placeholder "only available if the sync service is available". [V, Cloud Files API]
  - **Offline:** "You can't open online-only files when your device isn't connected". Espere erros como "The cloud file provider is not running" (0x8007016A), que no Node chegam como `UNKNOWN`/`EIO`. [V/S]
  - **Bloqueio de app:** hidratação em background mostra um **toast**. Se o usuário clicar em *Block app*, o `node.exe` fica bloqueado até ser liberado em *Settings → Privacy & security → Automatic file downloads*. Essa página pode não aparecer se houver GPO/MDM. [V/S]
- **Storage Sense:** "starting in Windows 11, version 22H2, the default for OneDrive cloud files is to make files online-only if not opened for more than 30 days". O Storage Sense vem desligado, mas o Windows pode ligá-lo quando falta disco. Arquivos "Always keep on this device" ficam **isentos**. [V]
  - Consequência: **memórias antigas e raramente abertas são exatamente as que viram placeholder.**
- **Obsidian:** a doc oficial manda evitar Files On-Demand e usar "Always keep on this device". O Obsidian lê tudo no start, o que **força o download** do vault inteiro. Staff do Obsidian em 2021: "We need your files present, they are the source of truth". Relatos de que o **OneDrive reseta o pin** depois de updates. [V/S]
- **Incidentes reais com agentes:**
  - `anthropics/claude-code#62140` (25/05/2026, Cowork): leu um placeholder truncado (**Size 137377, Blocks 0**), gravou por cima e **apagou conteúdo da nuvem em silêncio**. Fechado como *not planned*.
  - `NousResearch/hermes-agent#97898` (29/08/2026, aberto): um `find` do agente **hidratou o iCloud Photos a ~53 MB/s**.
- **Mitigações:**
  1. No onboarding, verificar e oferecer **pin** da pasta de memória: `attrib +P "<memoryRoot>" /S /D`. Explorer: *Always keep on this device*. Re-verificar a cada start. Herança automática para arquivos novos foi relatada por terceiros [S/NV]; revalide periodicamente.
  2. **Nunca varrer o vault inteiro nem o OneDrive inteiro.** Indexe só `memoryRoot`, mais globs explícitos que o usuário escolher.
  3. **Detectar placeholder antes de ler ou escrever.** No Windows, libuv preenche `st_blocks = AllocationSize >> 9` [V, código libuv]:
     ```ts
     import { statSync } from "node:fs";
     /** Heurística de placeholder desidratado (cloud-only). */
     export function looksDehydrated(p: string): boolean {
       const st = statSync(p);                 // stat lê só metadados: não hidrata
       return process.platform === "win32" && st.isFile() && st.size > 0 && st.blocks === 0;
     }
     ```
     Arquivos minúsculos residentes na MFT podem, em tese, reportar 0 blocos. Confirme com `attrib` antes de agir. [NV]
  4. **Guarda de encolhimento:** recuse gravar se o conteúdo novo for dramaticamente menor que o último tamanho conhecido (> 2×), a menos que a intenção seja explícita. É o que o bug #62140 sugere.
  5. Escrever sempre a partir de uma leitura **completa e verificada** (hash) do mesmo processo.

### 6.2 Conflitos e cópias duplicadas
- **Padrão documentado** para arquivos não-Office: "OneDrive automatically keeps both versions… the copy on your computer has your device name appended to the file name such as `Report-JOHNS-SURFACE.txt`". OneDrive for work or school guarda até 5 versões de conflito. [V, Microsoft Learn]
  - Sufixos no estilo Dropbox ("`(X's conflicted copy YYYY-MM-DD)`") aparecem em relatos de usuários de vault. Trate os dois padrões. [S]
- **`.obsidian/workspace.json`** (e `workspace-mobile.json`) muda a cada arquivo aberto. Com dois PCs abertos, vira fonte crônica de conflitos (`workspace-DESKTOP-XXXX.json`). [S]
- **Mitigações:**
  - **daily log por dispositivo** (`daily/2026-09-23.DESKTOP-AB12.md`), para que dois PCs nunca escrevam no mesmo arquivo de log;
  - consolidação em **um dispositivo designado** ou com lock lógico (§6.7);
  - scanner de cópias de conflito dentro de `memoryRoot`:
    ```ts
    import { hostname } from "node:os";
    // Registre o COMPUTERNAME de cada device no onboarding (ex.: <memoryRoot>/_devices.md)
    export function findConflictCopies(files: string[], devices = [process.env.COMPUTERNAME ?? hostname()]) {
      const alt = devices.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const re = new RegExp(`^(.*)-(${alt})(\\.[^.\\\\/]+)$`, "i");
      return files.flatMap((f) => {
        const m = re.exec(f);
        return m ? [{ copy: f, original: m[1] + m[3], device: m[2] }] : [];
      });
    }
    ```
    O que fazer com cada cópia encontrada:
    - não indexar como memória nova;
    - fazer merge por diff de linhas (append-only facilita);
    - mover a cópia para `archive/conflicts/`;
    - avisar o usuário.

### 6.3 Locks, `EPERM` e escrita atômica
- No Windows, `fs.rename(tmp, alvo)` falha com **`EPERM`/`EBUSY`/`EACCES`** quando Defender, Search Indexer, sync engine ou outro processo segura um handle transitório. O libuv **não faz retry** (`MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)`). O `graceful-fs` faz backoff de até ~60 s. O `write-file-atomic` não usa graceful-fs (issue #227, fev/2026, *closed not planned*). [V]
- **O OneDrive não sincroniza `.tmp` nem `.ini`** [V, Microsoft Learn GPO]. Um temporário `*.tmp` não vira upload fantasma. Se começar com `.`, o Obsidian também o ignora, porque arquivos e pastas ocultos ficam fora da Vault API. [V/S]
- **Temp + rename sob OneDrive, efeitos colaterais:**
  - o cliente Linux (abraunegg) documenta que salvar via rename vira "technically a new file"; ele cita vim, emacs, LibreOffice **e Obsidian** como apps com atomic save [S];
  - no cliente **oficial do Windows**, o efeito sobre **version history** e identidade do item é [NV]. Teste no onboarding: grave via rename e confira o histórico na web.
- **Padrão recomendado:** concorrência otimista + `.tmp` + rename com retry.
  ```ts
  import { promises as fs } from "node:fs";
  import { createHash, randomUUID } from "node:crypto";
  import { dirname, basename, join } from "node:path";

  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function renameWithRetry(from: string, to: string, tries = 10) {
    for (let i = 0; ; i++) {
      try { return await fs.rename(from, to); }
      catch (e: any) {
        if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || i >= tries) throw e;
        await sleep(Math.min(3000, 50 * 2 ** i));
      }
    }
  }

  /** Falha com CONFLICT se o arquivo mudou desde a leitura (Obsidian, outro device, OneDrive). */
  export async function writeIfUnchanged(file: string, next: string, expectedSha: string | null) {
    const cur = await fs.readFile(file, "utf8").catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
    if ((cur === null ? null : sha(cur)) !== expectedSha) throw new Error("CONFLICT: re-leia, faça merge e tente de novo");
    const tmp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
    await fs.writeFile(tmp, next, { encoding: "utf8", flag: "wx" });
    try { await renameWithRetry(tmp, file); } finally { await fs.rm(tmp, { force: true }); }
  }
  ```
  Existe uma janela TOCTOU entre a checagem e o rename. Ela é aceitável para memória, e o scanner de conflitos cobre o resto.
- No plugin API do Obsidian, a recomendação equivalente é `Vault.process()`, com a checagem de que o conteúdo do callback bate com o `cachedRead()`. [V, docs.obsidian.md]

### 6.4 Atrasos e pausas de sync
- O sync é **eventual**.
- O OneDrive **pausa sozinho** em *battery saver* e em **rede medida**, e o usuário pode pausar por 2/8/24 h. [S, Microsoft Support]
- Conflitos surgem justamente quando dois devices editam antes do upload terminar.
- **Mitigações:**
  - ADD-only;
  - releitura antes de escrever;
  - `modified` + `device` no frontmatter;
  - nunca confiar que "o que outro PC acabou de escrever" já chegou.

### 6.5 Caminhos e nomes
- **OneDrive:**
  - caminho decodificado ≤ **400 chars**;
  - sync local ≤ **520** (até 400 de caminho relativo + até 120 da raiz, e "OneDrive - Nome Longo da Org" consome caracteres);
  - segmento ≤ **255**;
  - apps Office no Windows não abrem > 260. [V]
- **Node:** o `fs` usa o prefixo `\\?\` internamente e suporta caminhos longos (exceto casos antigos de `realpath.native`, já corrigidos). [S] Git sem `core.longpaths` e outras ferramentas podem quebrar. O Obsidian em si não reclama. [S]
- **Proibidos no OneDrive:**
  - caracteres `" * : < > ? / \ |`;
  - espaço no início ou fim;
  - nomes `.lock`, `CON`, `PRN`, `AUX`, `NUL`, `COM0-9`, `LPT0-9`, `desktop.ini`, `~$*`, e `_vti_` em qualquer parte. [V]
- **Evitar também no Obsidian:** `# ^ [ ] |`, que quebram links, e `:`. [S]
- **Mitigação:** slugify ASCII-safe do nome (mantenha o título com acento em `title`/`aliases`), limite de ~80 chars por nome e árvore rasa.
- **Recomendação da Microsoft:** ≤ **300.000 itens** sincronizados para manter a performance. [V]

### 6.6 O que excluir e onde colocar cada coisa
- **Nunca dentro do OneDrive:**
  - **SQLite e WAL/SHM.** A SQLite documenta corrupção por backup/cópia no meio de transação e por separar `-wal`/`-journal` do DB, que é exatamente o que um sync por arquivo faz. [V, sqlite.org/howtocorrupt]
  - **`.git`:** relatos de corrupção e conflitos de `index.lock`. [S]
  - cache de modelos;
  - logs volumosos.
  - Coloque tudo isso em `%LOCALAPPDATA%\<app>\`.
- **Exclusão seletiva:** o OneDrive **não tem `.gitignore`**.
  - As GPOs **"Exclude specific kinds of files from being uploaded"** (`EnableODIgnoreListFromGPO`, com wildcards) e **"Exclude specific kinds of folders"** (`EnableODIgnoreFolderListFromGPO`, nome exato, sem wildcard, só para novas pastas) existem, mas são políticas de máquina (HKLM, admin). Não está claro se valem para contas pessoais [NV].
  - **Não automatize isso**: no máximo documente como opção avançada.
- **Dentro do vault, mas pequeno:**
  - os `.md` de memória;
  - opcionalmente um `config` de vault versionável (`<memoryRoot>/_memory.config.md` ou `.json`).
  - Evite `.smart-env/`, que o Smart Connections manda excluir de sync de terceiros.
- **`.obsidian/`:** o seu código não deve escrever lá. Em multi-PC, aceite conflitos em `workspace*.json` ou recomende ao usuário não manter o Obsidian aberto em dois PCs ao mesmo tempo.

### 6.7 Edições simultâneas (Obsidian + agente + outro dispositivo)

| Cenário | Mitigação |
|---|---|
| Usuário edita a nota aberta no Obsidian enquanto o agente grava | concorrência otimista (hash); o Obsidian faz merge ("modified externally, merging changes automatically"); prefira append em arquivos do agente e edite notas humanas raramente |
| Dois agentes (sessões pi) no mesmo PC | lock por arquivo (`.lock` fora do OneDrive, em `%LOCALAPPDATA%`) ou fila única no processo do indexador |
| Dois PCs | daily log por device + consolidação num device eleito; lock lógico com arquivo `_consolidation.lock.md` contendo device + timestamp + TTL (heurística; o OneDrive não garante exclusão mútua) [NV] |
| Rename ou move | não renomear via FS com o Obsidian aberto; usar `id` estável + `aliases`; ou Obsidian CLI `move` |

### 6.8 Como o Obsidian reage a mudanças externas
- O Obsidian atualiza o vault sozinho. [V]
- Nota aberta que muda no disco: merge automático, com relatos de perda de foco do cursor. [S]
- **Renames externos quebram links** (viram delete + create). [S]
- Arquivos e pastas ocultos (`.algo`) ficam fora do índice e da Vault API. [V]
- Plugins que reescrevem frontmatter em background (ex.: "updated") provocam loops de "modified externally". [S] Não atualize `modified` em toda leitura, só em escrita real.

### 6.9 Auto-detecção para o onboarding
- **Registro de vaults (interno, não documentado oficialmente):**
  - arquivo `%APPDATA%\obsidian\obsidian.json`. A pasta de settings globais `%APPDATA%\Obsidian\` é documentada [V]; o esquema abaixo vem de fórum e ferramentas [S].
  - Estrutura:
    ```json
    {"vaults":{"96a832d9c9cc9eca":{"path":"C:\\Users\\me\\OneDrive\\Notes","ts":1643208916609,"open":true}}}
    ```
  - A chave é um id hex arbitrário e único. `ts` é epoch em ms. `open` indica vault aberto. Pode haver outras chaves de topo; ignore-as.
  - O "nome" do vault é o **basename** do path (o CLI do Obsidian aceita `vault=<nome|id>`).
  - Existe também `%APPDATA%\obsidian\<id>.json` com estado de janela.
  - **Só leia.** Não escreva nesse arquivo com o Obsidian aberto.
- **Raízes do OneDrive:**
  - env vars `OneDrive` (primeira conta), `OneDriveConsumer` (pessoal) e `OneDriveCommercial` (trabalho/escola). São amplamente usadas, mas não achei doc oficial da Microsoft [S].
  - Registry `HKCU\Software\Microsoft\OneDrive\Accounts\{Personal|Business1..}\UserFolder` [S].
  - `HKCU\Software\SyncEngines\Providers\OneDrive\*\MountPoint` para bibliotecas SharePoint [S/NV].
- **Known Folder Move:** `Documents` e `Desktop` podem estar dentro do OneDrive. Use `realpath` e compare case-insensitive.
  ```ts
  import { readFileSync, existsSync, realpathSync } from "node:fs";
  import { join, basename, resolve, sep } from "node:path";
  import { execFileSync } from "node:child_process";

  type Reg = { vaults?: Record<string, { path: string; ts?: number; open?: boolean }> };

  export function listObsidianVaults() {
    const file = join(process.env.APPDATA ?? "", "obsidian", "obsidian.json");
    if (!existsSync(file)) return [];
    const reg = JSON.parse(readFileSync(file, "utf8")) as Reg;
    return Object.entries(reg.vaults ?? {}).map(([id, v]) => ({
      id, path: v.path, name: basename(v.path), open: !!v.open,
      lastOpened: v.ts ? new Date(v.ts) : undefined,
      valid: existsSync(join(v.path, ".obsidian")),
    }));
  }

  export function oneDriveRoots(): string[] {
    const roots = new Set<string>();
    for (const k of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]) if (process.env[k]) roots.add(process.env[k]!);
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\OneDrive\\Accounts", "/s", "/v", "UserFolder"],
                               { encoding: "utf8", windowsHide: true });
      for (const m of out.matchAll(/UserFolder\s+REG_SZ\s+(.+)$/gm)) roots.add(m[1].trim());
    } catch { /* sem OneDrive configurado */ }
    return [...roots];
  }

  const canon = (p: string) => { try { p = realpathSync.native(p); } catch {} return resolve(p).toLowerCase() + sep; };
  export const isInside = (child: string, root: string) => canon(child).startsWith(canon(root));
  ```
- **Checklist do wizard:**
  1. listar os vaults e escolher um (ou criar a pasta de memória);
  2. marcar "vault no OneDrive?";
  3. checar o estado de pin via `attrib "<memoryRoot>"` e oferecer `attrib +P … /S /D`, **com confirmação do usuário**;
  4. amostrar arquivos com `looksDehydrated`;
  5. detectar `Obsidian.exe` rodando e CLI no PATH, isto é, `Obsidian.com` no diretório de instalação (tipicamente `%LOCALAPPDATA%\Programs\Obsidian\`);
  6. registrar `COMPUTERNAME` em `_devices.md`;
  7. escolher o nível de busca (FTS / +vetores locais / +vetores remotos) e o modelo multilíngue;
  8. definir o budget de injeção;
  9. rodar um teste de escrita/rename e a indexação inicial;
  10. gerar o `.base` de dashboard (opcional).

---

## 7. Arquitetura sugerida (rascunho para discussão)
```text
<Vault>/Agent Memory/            ← memoryRoot configurável (pinned no OneDrive)
  MEMORY.md                      ← índice curado: 1 linha por memória → injetado (budget)
  USER.md                        ← perfil → injetado
  memories/<type>--<slug>.md     ← 1 memória/tema por arquivo (frontmatter abaixo)
  projects/<slug>/PROJECT.md     ← contexto por projeto (templates tipo Cline, lidos sob demanda)
  daily/2026/2026-09-23.DESKTOP-AB12.md  ← log append-only POR DISPOSITIVO (hoje+ontem injetados)
  inbox/                         ← propostas de consolidação para revisão humana
  archive/  archive/conflicts/   ← aposentadas e cópias de conflito (nunca apagar)
  _devices.md  _memories.base    ← devices conhecidos; dashboard Bases (opcional)
%LOCALAPPDATA%\pi-obsidian-memory\
  config.json   index\<vaultId>.sqlite(+wal/shm)   models\   locks\   logs\
```
```yaml
---
id: 01J9Z6X4M8K2Q7N3        # ULID estável: identidade ≠ nome do arquivo
type: feedback               # user | feedback | project | reference | decision | fact
description: Usar pnpm, nunca npm, no monorepo acme
tags: [pnpm, tooling]
project: acme-api
aliases: [pnpm-only]
created: 2026-09-23T14:02:11-03:00
modified: 2026-09-23T14:02:11-03:00
device: DESKTOP-AB12CD
pinned: false                # true ⇒ sempre injetado (como Letta system/)
source: session:2026-09-23#abc  # proveniência (taint gating)
---
- [decision] Usar pnpm workspaces #tooling
- relates_to [[projects/acme-api/PROJECT]]
```
**Tools (poucas):**
- `memory_search(query, {type, project, since, k})` → IDs + snippets;
- `memory_get(id|path, lines?)`;
- `memory_write(op: add|append|patch, …, expectedSha)`;
- `memory_forget(id)`, que **move para `archive/`**;
- opcional: handler `memory_20250818` para modelos Claude.

**Jobs:**
- indexador com watcher (debounce 1,5 s) + reconciliação no start;
- flush em `session_before_compact` com `NO_REPLY`;
- consolidação ("dreaming") diária ou no fim de sessão → `inbox/` + atualização do `MEMORY.md`;
- scanner de conflitos e placeholders;
- scanner de segurança em toda escrita (herdado do pi-hermes-memory);
- conteúdo do vault **injetado como dado delimitado**, porque qualquer pessoa ou device pode editá-lo.

---

## 8. Não verificado ou com divergência
- Se o default de semântica do basic-memory 0.23.2 é `true` (docs) ou `false` (tabela de env vars do README).
- Suporte a Dataview DQL em `POST /search/` na Local REST API 5.x (não aparece no README atual).
- Se o bug de "terminal como Administrador → CLI sem saída" persiste na GA do Obsidian CLI; "exit code sempre 0" e "~1 s/op" vêm de um guia de terceiros.
- Canal de distribuição do `aaronsb/obsidian-mcp-plugin` (oficial vs BRAT).
- Efeito do rename-replace (temp → rename) sobre **version history** no **cliente oficial** do OneDrive para Windows.
- Se `attrib +P` numa pasta faz novos arquivos herdarem o pin (há relatos de que sim no Explorer).
- `stat.blocks === 0` pode dar falso positivo em arquivos minúsculos residentes na MFT.
- Env vars `OneDrive*` e chaves de registry do OneDrive: sem doc oficial encontrada. Esquema do `obsidian.json`: só fórum e ferramentas (arquivo interno, pode mudar).
- As GPOs de exclusão do OneDrive valerem para contas pessoais.
- Dimensão exata (384) do multilingual-e5-small e default de `limit` dos blocks do Letta.
- Aspectos jurídicos da AGPL (não é aconselhamento jurídico).

---

## 9. Fontes principais
- basic-memory: [GitHub](https://github.com/basicmachines-co/basic-memory) · [LICENSE](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/LICENSE) · [PyPI](https://pypi.org/project/basic-memory/) · [pyproject](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/pyproject.toml) · [config_models.py](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/src/basic_memory/config_models.py) · [Knowledge format](https://docs.basicmemory.com/concepts/knowledge-format) · [MCP tools](https://docs.basicmemory.com/reference/mcp-tools-reference) · [Semantic search](https://docs.basicmemory.com/concepts/semantic-search) · [Configuration](https://docs.basicmemory.com/reference/configuration) · [Obsidian](https://docs.basicmemory.com/integrations/obsidian) · [.bmignore issue #1539](https://github.com/basicmachines-co/basic-memory/issues/1539) · [análise akitaonrails](https://github.com/akitaonrails/ai-memory/blob/main/docs/research-basic-memory.md)
- Obsidian: [CLI help](https://obsidian.md/help/cli) · [Changelog](https://obsidian.md/changelog/) · [1.12 changelog](https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/) · [Sync notes (OneDrive)](https://obsidian.md/help/sync-notes) · [Data storage](https://obsidian.md/help/data-storage) · [Vault API](https://docs.obsidian.md/Plugins/Vault) · [Headless](https://obsidian.md/help/headless) · [Free for work](https://obsidian.md/blog/free-for-work/) · [Fórum: obsidian.json](https://forum.obsidian.md/t/obsdian-json-automatic-vault-configuration/32700) · [Fórum: Files On-Demand](https://forum.obsidian.md/t/onedrive-cloud-saved-files-are-forcly-downloaded-by-obsidian/12885) · [Fórum: indexing OneDrive](https://forum.obsidian.md/t/obsidian-is-indexing-your-vault-onedrive/78418) · [Fórum: modified externally](https://forum.obsidian.md/t/has-been-modified-externally-merging-changes-automatically/111594) · [Fórum: renames externos](https://forum.obsidian.md/t/fr-detect-renames-made-outside-of-obsidian/92140) · [Guia CLI (dsebastien)](https://www.dsebastien.net/the-complete-guide-to-the-obsidian-cli-everything-you-can-do-from-the-terminal/) · [CLI no Windows (zenn)](https://zenn.dev/sora_biz/articles/obsidian-cli-setup-guide?locale=en) · [notesmd-cli](https://github.com/Yakitrak/notesmd-cli)
- Integrações: [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) · [releases](https://github.com/coddingtonbear/obsidian-local-rest-api/releases) · [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) · [cyanheads](https://github.com/cyanheads/obsidian-mcp-server) · [mcpvault](https://github.com/bitbonsai/mcpvault) · [aaronsb plugin](https://github.com/aaronsb/obsidian-mcp-plugin) · [Review ChatForest](https://chatforest.com/reviews/obsidian-mcp-servers/) · [ContextBolt](https://contextbolt.com/blog/obsidian-mcp-claude/) · [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) · [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) · [smart-connections-mcp](https://github.com/msdanyg/smart-connections-mcp) · [Omnisearch](https://github.com/scambier/obsidian-omnisearch) · [Omnisearch API](https://publish.obsidian.md/omnisearch/Public+API+%26+URL+Scheme)
- Memória: [OpenClaw memory](https://docs.openclaw.ai/concepts/memory) · [builtin engine](https://docs.openclaw.ai/concepts/memory-builtin) · [memory-search.ts](https://github.com/openclaw/openclaw/blob/main/src/agents/memory-search.ts) · [memory flush](https://docs.openclaw.ai/reference/session-management-compaction/housekeeping) · [walkthrough MMNTM](https://www.mmntm.net/articles/openclaw-memory-architecture) · [Anthropic memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) · [Claude Code memory](https://code.claude.com/docs/en/memory) · [Letta memory blocks](https://docs.letta.com/guides/agents/memory-blocks) · [Letta MemFS](https://docs.letta.com/concepts/memfs) · [Context Repositories](https://www.letta.com/blog/context-repositories/) · [Letta Filesystem (deprecated)](https://docs.letta.com/v1-sdk/concepts/filesystem) · [Cline Memory Bank](https://docs.cline.bot/prompting/cline-memory-bank) · [claude-mem](https://github.com/thedotmack/claude-mem) · [claude-mem DB](https://docs.claude-mem.ai/architecture/database) · [mem0 v3 migration](https://docs.mem0.ai/migration/platform-v2-to-v3) · [Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) · [pi-hermes-memory](https://pi.dev/packages/pi-hermes-memory) · [pi extensions](https://pi.dev/docs/latest/extensions) · [qmd](https://github.com/tobi/qmd)
- Busca/Node: [node:sqlite v26](https://nodejs.org/api/sqlite.html) · [node:sqlite v24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) · [sqlite.gyp (FTS5)](https://github.com/nodejs/node/blob/main/deps/sqlite/sqlite.gyp) · [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases) · [sqlite-vec](https://github.com/asg017/sqlite-vec) · [sqlite-vec JS](https://alexgarcia.xyz/sqlite-vec/js.html) · [sqlite-vec KNN](https://alexgarcia.xyz/sqlite-vec/features/knn.html) · [hybrid search (RRF)](https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html) · [FTS5](https://sqlite.org/fts5.html) · [How to corrupt SQLite](https://sqlite.org/howtocorrupt.html) · [transformers.js v4](https://huggingface.co/blog/transformersjs-v4) · [transformers.js env](https://huggingface.co/docs/transformers.js/api/env) · [EmbeddingGemma ONNX](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX) · [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) · [Orama](https://github.com/oramasearch/orama) · registry npm (`sqlite-vec`, `better-sqlite3`, `@huggingface/transformers`, `@orama/orama`, `minisearch`, `flexsearch`, `chokidar`, `@vscode/ripgrep`, `onnxruntime-node`, `node-llama-cpp`, `@tobilu/qmd`) · [write-file-atomic #227](https://github.com/npm/write-file-atomic/issues/227) · [libuv win/fs.c](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c) · [Node release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
- Microsoft/OneDrive: [Files On-Demand states (attrib)](https://learn.microsoft.com/en-us/sharepoint/files-on-demand-windows) · [Files On-Demand (default)](https://support.microsoft.com/en-us/office/save-disk-space-with-onedrive-files-on-demand-for-windows-0e6860d3-d9f3-4971-b321-7092438fb38e) · [Cloud Files API / placeholders](https://learn.microsoft.com/en-us/windows/win32/cfapi/build-a-cloud-file-sync-engine) · [Conflitos (Report-JOHNS-SURFACE)](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/sync/troubleshoot-sync-issues) · [Restrições e limites](https://support.microsoft.com/en-us/office/restrictions-and-limitations-in-onedrive-and-sharepoint-64883a5d-228e-48f5-b3d2-eb39e07630fa) · [Path length](https://support.microsoft.com/en-us/onedrive/what-are-file-path-length-limits) · [Storage Sense](https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/manage-drive-space-with-storage-sense) · [GPOs (ignore list, .tmp/.ini)](https://learn.microsoft.com/en-us/sharepoint/use-group-policy) · [Pause/resume sync](https://support.microsoft.com/en-us/onedrive/how-to-pause-and-resume-onedrive-sync) · [env vars OneDrive* (UWaterloo KB)](https://uwaterloo.atlassian.net/wiki/spaces/ISTKB/pages/43450564838/Using+OneDrive+in+place+of+Mapped+Drives) · [claude-code#62140](https://github.com/anthropics/claude-code/issues/62140) · [hermes-agent#97898](https://github.com/NousResearch/hermes-agent/issues/97898) · [abraunegg atomic saves](https://github.com/abraunegg/onedrive/blob/master/docs/usage.md) · [git no OneDrive (Tech Community)](https://techcommunity.microsoft.com/discussions/onedriveforbusiness/onedrive-is-corrupting-my-git-repositories/3898283)
