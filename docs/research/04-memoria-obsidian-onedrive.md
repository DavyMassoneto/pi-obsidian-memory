# 04 — Memória de agente em Obsidian + OneDrive: prior art e armadilhas

> Síntese do [anexo D](anexos/D-obsidian-memory.md) (pesquisa de 2026-09-23), que traz fontes, versões e o que ficou sem verificação.
> O código aqui é **ilustrativo e não testado**. Serve para mostrar a forma das soluções.

## TL;DR

1. **Não existe pronto** para "Obsidian + OneDrive + Windows + pi + sem limite". O mais próximo é o **basic-memory** (Markdown como fonte da verdade + índice SQLite + MCP). Ele é **AGPL-3.0** e em Python, então serve para copiar **ideias**, não código.
2. **Núcleo FS-first:** ler e escrever os `.md` direto com Node `fs`. Funciona com o Obsidian **fechado**. O Obsidian CLI (1.12+) fica como adaptador **opcional**, porque exige o app aberto e o abre se estiver fechado.
3. **Armazenamento ilimitado, injeção limitada:** índice pequeno + busca sob demanda + orçamento de tokens.
4. **O OneDrive é o maior risco técnico.** Os problemas são placeholders (arquivos só na nuvem), conflitos, `EPERM` no rename e SQLite corrompendo. Índices, locks e modelos ficam **fora** do OneDrive, em `%LOCALAPPDATA%`.

## Opções de integração com o Obsidian

| Opção | App aberto? | Prós | Contras | Licença |
|---|---|---|---|---|
| **FS direto (Node `fs`)** ⭐ | Não | Rápido, offline, controle total | Sem backlinks prontos; rename externo **quebra links** | Nossa |
| Obsidian CLI (1.12+, GA fev/2026) | **Sim** (abre a GUI) | `move`/`rename` atualizam links; `backlinks`, `unresolved`, `base:query` | ~1 s/op; exit code sempre 0 (segundo um guia de terceiros); Windows exige installer ≥ 1.12.7 | Proprietário, grátis |
| Local REST API 5.x (+ MCP embutido) | Sim | PATCH por heading/bloco/frontmatter | Plugin de terceiro, certificado próprio | MIT |
| cyanheads/obsidian-mcp-server, mcp-obsidian | Sim (via REST API) | Prontos | Mais uma camada | Apache-2.0 / MIT |
| mcpvault | Não | Edita frontmatter preservando formatação, BM25 | Teve vulnerabilidade de path no Windows (corrigida) | MIT |
| **kepano/obsidian-skills** ⭐ | — | Ensina o LLM a escrever Obsidian Markdown válido, Bases e Canvas | Não é runtime | MIT |
| Smart Connections | Sim | Busca semântica pronta | Grava `.smart-env/` **dentro do vault** (sincroniza); licença source-available | Proprietária |

## Designs de memória que valem copiar

| Sistema | Layout | Recuperação | O que pegar |
|---|---|---|---|
| **Hermes / pi-hermes-memory** | MEMORY.md + USER.md (`§`) | Snapshot congelado ou busca FTS5 | Scanner de segurança, revisão periódica, flush pré-compactação, `policy-only` |
| **basic-memory** (ideias) | 1 nota por entidade; `- [categoria] fato #tag`; `- relacao [[Alvo]]` | FTS5 + vetores (sqlite-vec) híbrido; `build_context` em grafo | **id estável ≠ nome do arquivo**, fatos atômicos, relações em wikilink, `expected_checksum` |
| **OpenClaw** | `MEMORY.md` curado + `memory/AAAA-MM-DD.md` (daily log) | Híbrido 0,7 vetor / 0,3 texto, decay de 30 dias, MMR λ 0,7 | **Hoje + ontem** no início da sessão; flush silencioso antes da compactação (`NO_REPLY`); "dreaming" com revisão humana |
| **Claude Code auto-memory** | `MEMORY.md` = índice (1 linha por memória) + 1 arquivo por memória com `type` | Índice injetado (200 linhas / 25 KB); o resto é lido sob demanda | Índice + topic files; taxonomia `user / feedback / project / reference` |
| **Letta MemFS** | `system/` sempre carregado; o resto aparece como árvore + `description` | Progressive disclosure | Flag `pinned`; `description` obrigatória; "defrag" periódico |
| **claude-mem** | SQLite | search → timeline → detalhe | Busca em 3 camadas (IDs + snippet primeiro) |
| **mem0 v3** | Vector DB | Semântico + BM25 + entidades | Escrita **só de adição**; conflitos resolvidos no ranking |
| **@tenchi4u/pi-obsidian-memory** | `$OBSIDIAN_PATH/pi/` (MEMORY, SCRATCHPAD, daily/) | qmd; snapshot com orçamento de 16K chars | Config do path do vault; notas para Windows |

> Curiosidade: a memória desta própria sessão do Claude Code já é Obsidian-compatível. É uma pasta com `MEMORY.md` (índice), arquivos com frontmatter e links `[[nome]]`.

## Padrão de recuperação para memória ilimitada

```text
                ┌──────────── injetado no início da sessão (frozen snapshot, com orçamento) ────────────┐
Prompt ◄────────│ USER.md · índice MEMORY.md (1 linha/memória) · pinned: true · daily log de hoje+ontem │
                └──────────────────────────────────────────────────────────────────────────────────────┘
  sob demanda:  memory_search(q) → [id, título, snippet, score]   →   memory_get(id | path, linhas)
  ranking:      BM25 (FTS5) [+ vetor opcional] → decay por recência (evergreen não decai) → MMR → minScore
  escrita:      só adição no dia a dia (daily log POR DISPOSITIVO) → consolidação fora do fluxo → inbox/ p/ revisão
```

```ts
// Índice FTS5 com node:sqlite (Node ≥ 22.13; FTS5 já compilado; sem build nativo) — ilustrativo
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "index", "vault.sqlite"));
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  heading, body, tokenize = "unicode61 remove_diacritics 2")`);  // "decisao" encontra "decisão"
```

Para português:
- use o tokenizer `unicode61 remove_diacritics 2`;
- se houver vetores, use embeddings **multilíngues** (multilingual-e5-small ou EmbeddingGemma) e evite o `bge-small-en`, que é só inglês;
- em JS, tokenize com `\p{L}` (o `\W` quebra palavras acentuadas).

## OneDrive + Obsidian no Windows: armadilhas e mitigações

| # | Armadilha | Mitigação |
|---|---|---|
| 1 | **Files On-Demand** vem ligado e não dá para desligar nos builds novos. O **Storage Sense** deixa arquivos online-only após 30 dias sem abrir, e são justamente as memórias antigas | No onboarding, **fixar** a pasta de memória com `attrib +P "<pasta>" /S /D` (**com sua confirmação**) e revalidar a cada início. Detectar placeholder com `stat.blocks === 0 && size > 0` |
| 2 | Ler um placeholder **baixa** o arquivo; offline, falha. O Windows pode mostrar um aviso que bloqueia o `node.exe` | Tratar os erros; orientar a liberar o app em *Settings → Automatic file downloads* |
| 3 | **Incidente real** (claude-code#62140, mai/2026): um agente leu um placeholder truncado, gravou por cima e **apagou o conteúdo na nuvem** | **Guarda de encolhimento:** recusar gravação que diminua muito o arquivo; sempre gravar a partir de uma leitura completa verificada por hash |
| 4 | **Conflitos** viram cópias `Nota-NOMEDOPC.md` (também em `.obsidian/workspace.json`) | Daily log **por dispositivo**; consolidação num único dispositivo; scanner de cópias de conflito → `archive/conflicts/` |
| 5 | `rename` falha com `EPERM`/`EBUSY` (OneDrive, Defender, indexador) | Temporário `.nome.<uuid>.tmp` (o OneDrive não sincroniza `.tmp` e o Obsidian ignora dotfiles) + `rename` com retry e backoff |
| 6 | **SQLite (WAL) e `.git` corrompem** dentro de pasta sincronizada | Índice, locks, modelos e logs em `%LOCALAPPDATA%\<app>\`; o vault guarda **só Markdown** |
| 7 | Renomear pelo filesystem com o Obsidian aberto **quebra os wikilinks** | `id` estável no frontmatter + `aliases`; se precisar renomear, usar `obsidian move` com o app aberto |
| 8 | Limites de caminho (400 chars na nuvem) e caracteres proibidos (`" * : < > ? \| # ^ [ ]`) | Slug ASCII de até ~80 chars (título com acento vai em `title`/`aliases`); árvore rasa |
| 9 | Sync pausado (economia de bateria, rede medida) | Reler antes de gravar; `device` + `modified` no frontmatter; nunca assumir que o outro PC já sincronizou |

```ts
// Escrita segura sob OneDrive — ilustrativo (versão completa no anexo D §6.3)
export async function writeIfUnchanged(file: string, next: string, expectedSha: string | null) {
  const cur = await readOrNull(file);
  if (hash(cur) !== expectedSha) throw new Error("CONFLICT: re-leia e faça merge");   // concorrência otimista
  if (cur && next.length < cur.length / 2 && !intentionalShrink) throw new Error("SHRINK_GUARD"); // incidente #62140
  const tmp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, next, { flag: "wx" });
  await renameWithRetry(tmp, file);          // EPERM/EBUSY/EACCES → backoff exponencial
}
```

## Auto-detecção para o onboarding

```ts
// Vaults conhecidos pelo Obsidian (arquivo interno, não documentado: SÓ LEITURA) — ilustrativo
// %APPDATA%\obsidian\obsidian.json → {"vaults":{"<id>":{"path":"C:\\...\\OneDrive\\...","ts":1643208916609,"open":true}}}
const reg = JSON.parse(readFileSync(join(process.env.APPDATA!, "obsidian", "obsidian.json"), "utf8"));
const vaults = Object.entries(reg.vaults ?? {}).map(([id, v]: any) => ({ id, path: v.path, name: basename(v.path) }));
// Raízes do OneDrive: env OneDrive / OneDriveConsumer / OneDriveCommercial (+ HKCU\Software\Microsoft\OneDrive\Accounts\*\UserFolder)
// Comparar caminhos com realpath e sem diferenciar maiúsculas (Known Folder Move pode pôr Documents dentro do OneDrive)
```

**Checklist do wizard sugerido:**
1. listar os vaults e escolher um;
2. dizer se a pasta fica dentro do OneDrive;
3. **pin** da pasta de memória (com confirmação);
4. amostrar placeholders;
5. ver se o Obsidian está aberto e se o CLI está disponível;
6. registrar o dispositivo;
7. escolher o nível de busca;
8. definir o orçamento de injeção;
9. testar escrita e rename;
10. fazer a indexação inicial;
11. (opcional) gerar um dashboard `.base` das memórias.

## Esboço de layout dentro do vault (para discussão)

```text
<Vault>/Agent Memory/                    ← pasta raiz configurável (fixada no OneDrive)
  MEMORY.md                              ← índice curado: 1 linha por memória → injetado (com orçamento)
  USER.md                                ← perfil → injetado
  memories/<tipo>--<slug>.md             ← 1 memória por arquivo, com frontmatter
  projects/<slug>/PROJECT.md             ← contexto por projeto
  daily/2026/2026-09-23.DESKTOP-AB12.md  ← log só de adição, POR DISPOSITIVO
  inbox/  archive/  archive/conflicts/   ← propostas de consolidação; nada é apagado
%LOCALAPPDATA%\pi-obsidian-memory\       ← config de máquina, index\*.sqlite, models\, locks\, logs\
```

```yaml
---
id: 01J9Z6X4M8K2Q7N3        # ULID: identidade estável, independente do nome do arquivo
type: feedback               # user | feedback | project | reference | decision | fact
description: Usar pnpm, nunca npm, no monorepo acme
tags: [pnpm, tooling]
project: acme-api
created: 2026-09-23T14:02:11-03:00
modified: 2026-09-23T14:02:11-03:00
device: DESKTOP-AB12CD
pinned: false                # true ⇒ sempre injetado
source: session:2026-09-23#abc
---
```
