# 03 — Anatomia do pi-hermes-memory (a base que queremos reaproveitar)

> Leitura do código-fonte de `chandra447/pi-hermes-memory` **v0.9.9** (2026-09-13) e do pi **v0.87.1** (2026-09-22), feita em 2026-09-23 via web, sem instalar nem executar nada.
> Mapa arquivo a arquivo, trechos com linha, issues relevantes e fontes: [anexo C](anexos/C-pi-hermes-memory.md).

## Ficha técnica

| Item | Valor |
|---|---|
| Licença | **MIT** (© 2025 Chandra Teja). É porte do Hermes Agent, também MIT (© 2025 Nous Research). **Pode reaproveitar código, desde que mantenha os dois avisos de copyright.** |
| Popularidade | ~456★, ~21,6 mil downloads/mês no npm, mais de 50 versões desde abr/2026, upstream ativo |
| Runtime | Extensão pi em TypeScript carregada via jiti; `better-sqlite3` **nativo**; testes com `node:test` (a descrição fala em 732) |
| CI | **Só Ubuntu**, sem CI em Windows |
| Plataforma | O pi agora é `@earendil-works/pi-coding-agent` (repositório `earendil-works/pi`, MIT, ~108k★); o antigo `badlogic/pi-mono` redireciona para lá |

## Como funciona hoje

```text
~/.pi/agent/
├── hermes-memory-config.json            ← config (lida 1x; se inválida, volta aos defaults SEM avisar)
├── pi-hermes-memory/                    ← memória global
│   ├── MEMORY.md   USER.md   failures.md   STANDING.md
│   ├── skills/<slug>/SKILL.md
│   ├── sessions.db (+ -wal, -shm)       ← SQLite: espelho de busca (FTS5 trigram) + índice de sessões
│   └── .tmp-*/  .MEMORY.md.recovery-*   ← escrita atômica e snapshots de recuperação (até 32 / 64 MiB)
├── projects-memory/<nome-do-repo>/MEMORY.md   ← memória por projeto (nome = basename da raiz git)
└── .pi-hermes-locks.sqlite              ← lock entre processos, gravado no PAI da pasta de memória
```

```md
<!-- MEMORY.md — formato (ilustrativo): uma entrada por bloco, separadas por "\n§\n" -->
Projeto usa pnpm, não npm <!-- created=2026-09-01, last=2026-09-20 -->
§
CI exige --frozen-lockfile <!-- created=2026-09-02, last=2026-09-02 -->
```

O Markdown é a fonte da verdade e o SQLite é índice derivado. Esse princípio **vale manter**.

### Tools expostas ao modelo

| Tool | O que faz |
|---|---|
| `memory_add` | `target` ∈ {memory, user, project, failure}; scanner de segurança; dedupe exato |
| `memory_replace` / `memory_remove` | Localiza a entrada por **substring** (`old_text`) e exige exatamente 1 match |
| `memory_search` | FTS5 trigram + bm25; stop-words **só em inglês** |
| `session_search` | Busca no histórico de sessões do pi (JSONL indexado no SQLite) |
| `skill_manage` | CRUD de `SKILL.md` (global ou por projeto) |

### Como a memória entra no prompt

```ts
// src/index.ts (≈L217) — roda a cada prompt do usuário
pi.on("before_agent_start", async (event) => {
  const ctx = await buildPromptContext(config, store, projectStoreRef(), projectNameRef(), standingStore);
  if (ctx) return { systemPrompt: event.systemPrompt + "\n\n" + ctx };
});
```

- **`policy-only` (padrão desde a v0.7):** injeta **só instruções**, nenhum conteúdo de memória. O modelo precisa chamar `memory_search`. É estável e amigável ao prompt cache.
- **`legacy-inject`:** injeta um snapshot de `MEMORY.md`/`USER.md`, o bloco do projeto e as falhas recentes, como no Hermes original.
- **`STANDING.md`:** regras fixadas por você com `/memory-pin`, sempre injetadas; limite de 20 entradas / 2.000 chars.

### O que salva a memória automaticamente

| Mecanismo | Quando dispara | Como |
|---|---|---|
| **Revisão em background** | A cada 10 turnos ou 15 tool calls (com pelo menos 3 mensagens suas) | Chama o LLM, que devolve JSON `{"operations":[…]}`; o pacote aplica as operações |
| **Detector de correções** | Frases como "don't do that" ou "actually, use…" | Regex **só em inglês** → LLM → salva |
| **Flush** | Antes da compactação (aguarda até 60 s) e no encerramento (até 10 s) | — |
| **Scanner de conteúdo** | Toda escrita | Bloqueia prompt injection, unicode invisível e segredos (`sk-…`, `ghp_…`, chaves privadas…) |

## "O limite dele": o que é de fato

| Limite | Valor | Aplicado? |
|---|---|---|
| MEMORY / USER / projeto | 5.000 chars cada (failures: 10.000) | **Só em `legacy-inject`.** No `policy-only` (padrão), `capEnforced = false` desde o #218: as escritas passam, e o "NN% usado" é só informativo |
| STANDING.md | 20 entradas / 2.000 chars | Sim (constante no código) |
| Busca | até 20 resultados; snippets até 4.000 chars | Sim, por chamada |

**Conclusão:** no modo padrão, o limite de **armazenamento** quase não existe mais. O limite real é outro: **quanto da memória chega ao modelo**. No `policy-only`, só chega o que a busca devolve, e a busca é lexical e ajustada para inglês.

Remover limites, portanto, é sobretudo **melhorar a recuperação**:
- busca que entenda pt-BR;
- um "active recall" com orçamento de tokens;
- IDs estáveis;
- consolidação.

Apagar constantes é a parte pequena.

## O que quebra se só apontarmos o `memoryDir` para o vault

Hoje dá para configurar `"memoryDir": "C:/Users/<você>/OneDrive/<Vault>/Agent Memory"`. **Não recomendado.** Isso levaria para dentro do OneDrive:

- `sessions.db` com WAL/SHM. SQLite dentro de pasta sincronizada **corrompe**, conforme a documentação do próprio SQLite;
- `.pi-hermes-locks.sqlite` na **raiz do vault** (a pasta pai);
- `.tmp-*`, `.recovery-*` (cópias completas do arquivo) e **hard links** (`fs.link`), que interagem mal com placeholders e locks do OneDrive. Só `ENOENT`/`EEXIST` são tratados; `EPERM`/`EBUSY` viram erro.

Além disso:
- a memória **por projeto** não sai de `~/.pi/agent` sem mudar código, porque `projectsMemoryDir` aceita um único segmento sob o `AGENT_ROOT`;
- **cópias de conflito** do OneDrive (`MEMORY-DESKTOP-XXXX.md`) seriam ignoradas silenciosamente.

## Pontos de corte (seams)

**Não existe interface de armazenamento.** `MemoryStore`, `SkillStore`, `StandingInstructions` e `DatabaseManager` usam `node:fs`/`better-sqlite3` diretamente. O `MemoryBackend`/`MemoryOrchestrator` previsto no ROADMAP (v0.5) nunca foi implementado.

O corte natural é separar a **lógica sobre `entries[]`** da **persistência**:

```ts
// ESBOÇO (não é código do projeto): a interface que falta
interface MemoryBackend {
  read(scope: Scope): Promise<{ entries: Entry[]; fingerprint: string }>;
  write(scope: Scope, next: Entry[], expectedFingerprint: string): Promise<void>; // CONFLICT se mudou
  list(): Promise<Scope[]>;                    // global, user, projeto X, …
  watch?(onChange: (s: Scope) => void): () => void;
}
// Hoje: tudo isso está dentro de MemoryStore (loadFromDisk/readFileState/saveToDisk/prune…)
// Depois: FileBackend (atual)  +  ObsidianVaultBackend (novo)
```

Arquivos que precisam mudar para cada objetivo (detalhe por função no anexo C, §2.14):

| Objetivo | Arquivos |
|---|---|
| **Vault(s) no OneDrive** | `config.ts`, `types.ts`, `paths.ts`, `project.ts`, `index.ts`, `store/memory-store.ts`, `store/markdown-mutation-lock.ts`, `store/db.ts`, `handlers/sync-markdown-memories.ts`, `store/sqlite-memory-store.ts`, migrações |
| **Sem limites** | `memory-store.ts` (`charLimit`, `capEnforced`, `fifoEvictAndAdd`, `addWithConsolidation`), `index.ts` (consolidator), config (chaves de limite). Cuidado: `memoryCharLimit: 0` **bloqueia tudo**; "ilimitado" precisa de `null` explícito |
| **Configurável + onboarding** | `config.ts` reescrito (schema TypeBox versionado, erros visíveis, writer atômico); comando novo de setup com `ctx.ui.select/input/confirm` + `ctx.reload()`; prompts configuráveis (issue #229) |
| **Windows** | Probe do lock abre PowerShell no load (~515 ms, #245/#247); provável bug `header.cwd.split('/')` no `session-indexer.ts` (inferido); sem CI Windows |

## A plataforma: o que o pi oferece para o novo projeto

```ts
// Esqueleto de extensão (APIs reais do pi; lógica é esboço)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => { /* abrir índice local; se não houver config → ctx.ui.notify("/memory-setup") */ });
  pi.on("before_agent_start", (e) => { e.systemPromptOptions.sections.memory_policy = POLICY; }); // estável → cache
  pi.on("context", async (e) => { /* active recall por turno SEM mexer no system prompt */ });
  pi.on("session_before_compact", async () => { /* flush: grave o que for durável antes de compactar */ });
  pi.on("session_shutdown", async () => { /* fechar índice (idempotente) */ });
  pi.registerTool(memoryAddTool);                 // schema TypeBox; result { content, details }
  pi.registerCommand("memory-setup", { handler: async (_a, ctx) => {
    const vault = await ctx.ui.select("Vault", vaultsDetectados);   // + input, confirm, editor, custom
    /* validar, gravar config atomicamente */ await ctx.reload();    // aplica sem reiniciar o pi
  }});
}
```

- **Eventos úteis:** `session_start`, `before_agent_start` (mutar seções), **`context`** (transformar mensagens só para aquela requisição, sem invalidar o cache do system prompt), `session_before_compact`, `turn_end`, `tool_call` (bloquear ou alterar chamadas), `session_shutdown`, `resources_discover` (expor pastas de skills).
- **Regra do pi:** não abra watchers, DB ou timers no factory da extensão. Faça isso em `session_start` e feche em `session_shutdown`.
- **UI:** `ctx.hasUI` indica se há diálogos (TUI/RPC). Existem exemplos oficiais `question.ts` e `questionnaire.ts`, que servem de base para o wizard.

## Pacotes pi que já tentaram algo parecido

| Pacote | Por que olhar |
|---|---|
| **@tenchi4u/pi-obsidian-memory** (MIT) | Memória no vault (`$OBSIDIAN_PATH/pi/`), notas para Windows, snapshot "stable" vs "per-turn" com orçamento de ~16K chars. **A referência mais próxima** |
| **@pify/memory** (MIT) | FTS5 via **`node:sqlite`** embutido, sem módulo nativo, o que evita a dor do `better-sqlite3` no Windows |
| **@zosmaai/pi-llm-wiki** (MIT) | Wiki mantida por LLM em vault compatível com Obsidian (citada na issue #229) |
| **pi-memory** (jayzeng), **common-memory-core** | Daily logs + qmd; memória Markdown "do usuário" |
| **@bacnh85/pi-obsidian** (MIT) | Acesso ao vault via Obsidian CLI |
| @sfroment/pi-obsidian | ⚠️ **GPL-3.0**: não incorporar em código MIT |

Issues e PRs do upstream que mostram demanda pelo mesmo caminho:
- **#229:** instruções de review customizáveis para cooperar com um vault Obsidian;
- **#216:** active recall no início da sessão;
- **#175:** busca semântica via qmd.

## Três caminhos de reaproveitamento

| Caminho | Prós | Contras |
|---|---|---|
| **1. Fork + refactor** (extrair `MemoryBackend`, criar backend de vault) | Herda testes, review, correction, flush, scanner, busca e skills | Código grande e acoplado; o upstream é ativo, então o fork diverge rápido; carrega legado (migrações, hard links, recovery) |
| **2. Pacote novo "Obsidian-first" reusando módulos** (scanner, fts-query, protocolo de review, prompts, session-indexer) | Design limpo: nota por memória, IDs estáveis, índice local; sem legado | Mais trabalho; perde a integração pronta |
| **3. Contribuir upstream** (interface de backend + prompts configuráveis) e publicar o backend de vault como pacote | Beneficia os dois lados; demanda já existe (#229) | Depende de aceite e prazo do mantenedor |

A recomendação e o mapa módulo a módulo estão em [05-proposta-reaproveitamento.md](05-proposta-reaproveitamento.md).
