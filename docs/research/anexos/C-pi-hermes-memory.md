# Pesquisa C: pi coding agent e pi-hermes-memory

> Base para um novo pacote que **reutiliza o pi-hermes-memory**, mas grava a memória em **vaults Obsidian dentro do OneDrive (Windows)**, **sem limites de tamanho**, com **tudo configurável** e um **fluxo de onboarding/configuração**.

- **Data da pesquisa:** 2026-09-23
- **Método:** leitura de código e docs via WebFetch (raw.githubusercontent.com, api.github.com, registry.npmjs.org, pi.dev, docs oficiais). Nada foi clonado, instalado ou executado.
- **Snapshots lidos:**
  - `chandra447/pi-hermes-memory`, branch `main` = commit `71ce9f0` ("chore: bump version to 0.9.9 (#240)", 2026-09-13), ou seja, **v0.9.9**
  - `earendil-works/pi`, branch `main` (release mais recente **v0.87.1**, publicada em 2026-09-22T19:43Z)
  - `NousResearch/hermes-agent`, branch `main` (último push em 2026-09-23)
- **Convenções:**
  - `≈L123` indica um número de linha **aproximado**. O extrator às vezes desalinha a numeração, então use o nome da função ou constante como âncora.
  - Os trechos de código são curtos e vêm de repositórios com licença MIT; a atribuição está nos links.
  - Itens marcados **(não verificado)** não foram confirmados numa fonte primária.

---

## 0. Resumo executivo

| Tema | Achado |
|---|---|
| Plataforma | O pi agora é `@earendil-works/pi-coding-agent` (CLI `pi`), no monorepo `earendil-works/pi`. O antigo `badlogic/pi-mono` redireciona para lá. Licença MIT. Versão atual: 0.87.1. |
| Licença do pacote base | **MIT**, "Copyright (c) 2025 Chandra Teja". É porte do Hermes Agent, que também é **MIT** ("Copyright (c) 2025 Nous Research"). O reuso é livre desde que se preservem os avisos de copyright e de licença. |
| Onde grava | Memória global em `~/.pi/agent/pi-hermes-memory/` (`MEMORY.md`, `USER.md`, `failures.md`, `STANDING.md`, `skills/`, `sessions.db`). Memória por projeto em `~/.pi/agent/projects-memory/<projeto>/`. Config em `~/.pi/agent/hermes-memory-config.json`. |
| Formato | Um arquivo Markdown por "target", com entradas separadas por `"\n§\n"`. Cada entrada leva metadados num comentário HTML: `<!-- created=…, last=…, project64=… -->`. O SQLite (FTS5 trigram) é **espelho** de busca; o Markdown é a fonte da verdade. |
| Limites | O padrão é 5.000 caracteres para memory, user e project, e o dobro para failure. No modo padrão `policy-only` esses limites **já não são aplicados** às escritas (`capEnforced = memoryMode !== "policy-only"`, desde o #218). Continuam valendo no modo `legacy-inject`. `STANDING.md` tem limite fixo de 20 entradas / 2.000 caracteres. |
| Tools | `memory_add`, `memory_replace`, `memory_remove` (targets `memory`, `user`, `project`, `failure`), `memory_search` (SQLite FTS5), `session_search` (variante FTS5 "legacy" ou "anchors" sobre JSONL) e `skill_manage`. |
| Injeção | Em `before_agent_start` (a cada prompt do usuário) o pacote concatena ao system prompt. **Padrão `policy-only`:** só um texto de *policy*, sem conteúdo de memória, e o modelo precisa chamar `memory_search`. **`legacy-inject`:** snapshot "congelado" de MEMORY/USER, mais bloco do projeto e falhas recentes. As *standing instructions* entram sempre. |
| Seams | **Não existe interface/adapter de storage.** `MemoryStore`, `SkillStore`, `StandingInstructions` e `DatabaseManager` são classes concretas com `node:fs` e `better-sqlite3` direto. Os paths vêm de `paths.ts`, `project.ts` e `index.ts`. O `MemoryBackend`/`MemoryOrchestrator` do ROADMAP (v0.5) **nunca foi implementado**. |
| Armadilhas OneDrive | Se `memoryDir` apontar para o OneDrive, vão junto: `sessions.db` (WAL), `.tmp-*`, `.recovery-*`, hard links (`fs.link`) **e** o `.pi-hermes-locks.sqlite`, que é gravado na pasta **pai** do diretório de memória. Não há como apontar `projectsMemoryDir` para fora de `~/.pi/agent` sem mudar código. |
| Onboarding | Hoje só existe o `/memory-interview`, que envia um prompt ao LLM para preencher o `USER.md`. Não há wizard de configuração. O pi oferece `ctx.ui.select/input/confirm/editor/custom` e `ctx.reload()`, que bastam para construir um. |

---

## Parte 1: o pi coding agent (plataforma)

### 1.1 O que é o pi (identidade e versões)

- **Pacote npm atual:** `@earendil-works/pi-coding-agent` ("Coding agent CLI with read, bash, edit, write tools and session management"). O binário é `pi` (`dist/cli.js`).
  - dist-tags: `latest` = **0.87.1**, `legacy-node20` = 0.74.2.
  - Primeira versão com o escopo novo: 0.74.0.
  - Fonte: https://registry.npmjs.org/@earendil-works/pi-coding-agent
- **Releases recentes** (https://api.github.com/repos/earendil-works/pi/releases):
  - v0.87.1: 2026-09-22
  - v0.87.0: 2026-09-21
  - v0.86.1: 2026-09-20
  - v0.86.0: 2026-09-19
  - v0.85.1: 2026-09-05
- **Repositório:** https://github.com/earendil-works/pi. A consulta a `api.github.com/repos/badlogic/pi-mono` devolve `earendil-works/pi`, ou seja, redirecionamento.
  - "AI agent toolkit: unified LLM API, agent loop, TUI, coding agent CLI". MIT, cerca de 108,6k stars.
- **Autoria:** criado por Mario Zechner (`badlogic`). Mantenedores no npm: `badlogic`, `mitsuhiko` (Armin Ronacher) e `rwachtler`.
  - A transferência para a Earendil Works e a renomeação `@mariozechner/*` → `@earendil-works/*` a partir da 0.74.0 aconteceram em maio/2026 segundo a Wikipedia **(data não verificada em fonte primária)**.
- **Proposta** (https://pi.dev):
  - Harness mínimo e extensível: extensões, skills, prompt templates, temas e pacotes.
  - Mais de 15 providers via `@earendil-works/pi-ai`.
  - Histórico de sessão em árvore, com branching.
  - Compaction automática.
  - Modos: interativo (TUI), print/JSON, RPC e SDK.
- **Omissões deliberadas do core** (pi.dev): sem MCP, sem sub-agents, sem plan mode, sem popups de permissão, sem to-dos embutidos, sem background bash. Tudo isso fica a cargo de extensões e pacotes, o que explica o ecossistema grande da Parte 4.
- **Instalação:** `curl -fsSL https://pi.dev/install.sh | sh` ou `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`.

### 1.2 Pacotes (`pi install`, manifest, convenções)

Fonte: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md

- **Definição:** um pacote é um diretório comum ou um pacote npm. Pode conter **extensions, skills, prompt templates e themes**, seja por diretórios convencionais, seja por declaração explícita no `package.json` (chave `pi`). Pode ter dependências de runtime próprias.
- **Instalação:**
  ```bash
  pi install npm:@example/pi-tools@1.0.0      # versão npm (pinada)
  pi install git:github.com/example/pi-tools@v1 # tag/commit git (pinado)
  pi install ./local-package                   # caminho local
  pi install -l npm:...                        # escopo de projeto → .pi/settings.json
  pi -e ./minha-extensao.ts                    # carrega só nesta execução (sem instalar)
  ```
  - O escopo padrão é o do usuário, gravado em `~/.pi/agent/settings.json` (chave `packages`).
  - Outros comandos: `pi list`, `pi remove <source>`, `pi update --extensions`, `pi config` (habilita/desabilita recursos).
- **Onde fica no disco** (`src/core/package-manager.ts`, ≈L2330 e ≈L2360):
  - npm, usuário: `<agentDir>/npm/node_modules/<nome>`
  - npm, projeto: `<cwd>/.pi/npm/node_modules/<nome>`
  - git, usuário: `<agentDir>/git`
  - git, projeto: `<cwd>/.pi/git`
  - O `npm install` dos pacotes git **não** usa `--ignore-scripts`, então os install scripts rodam. Isso importa para dependências nativas como o `better-sqlite3`.
- **Manifest** (exemplo da doc):
  ```json
  {
    "name": "my-pi-package",
    "keywords": ["pi-package"],
    "pi": {
      "extensions": ["./src/extension.ts"],
      "skills": ["./resources/skills"],
      "prompts": ["./resources/prompts/*.md"],
      "themes": ["./resources/themes/*.json"]
    }
  }
  ```
  - A keyword `pi-package` torna o pacote elegível para a galeria https://pi.dev/packages.
  - Os campos opcionais `pi.image` e `pi.video` servem de preview.
  - Sem manifesto, o pi descobre os diretórios `extensions/`, `skills/`, `prompts/` e `themes/`.
- **Dependências:**
  - Os pacotes do pi devem ser `peerDependencies` com range `"*"` e **não** devem ir no bundle: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui` e `typebox`.
  - Observação: o pi-hermes-memory usa `>=0.80.6` nos peers e coloca `@earendil-works/pi-tui` em `dependencies`, o que diverge da recomendação.
- **Filtro por settings:** a entrada em `packages` pode ser um objeto `{ source, extensions: [...], skills: [], prompts: [...] }`. Omitir uma chave carrega tudo, `[]` não carrega nada e `!pattern` exclui.
- **Trust:** pacotes de projeto só são instalados e carregados depois de resolvida a *project trust*. Arquivos de contexto (AGENTS.md) não exigem trust.
- **Galeria:** em 2026-09-23 a https://pi.dev/packages listava **5.723 pacotes** extraídos do npm pela keyword, com filtro por tipo e ordenação por downloads, data ou nome.

### 1.3 Extension API (TypeScript)

Fontes:
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts

#### Definição e carregamento

- Uma extensão é um módulo com `export default function (pi: ExtensionAPI)`, síncrono ou assíncrono. O pi aguarda factories assíncronas.
- **Carregamento:**
  - de `~/.pi/agent/extensions/` e `.pi/extensions/` (arquivos `.ts`/`.js` diretos, ou subpastas com `index.ts`/`index.js`);
  - de caminhos declarados em settings (`extensions`);
  - de pacotes;
  - via `pi --extension ./x.ts`.
- TypeScript é carregado com **jiti**, sem etapa de build.
- **Regra de lifecycle:** **não** inicie processos, sockets, watchers ou timers no factory, porque algumas invocações carregam extensões sem sessão. Inicie recursos em `session_start` (ou na tool/command que precisa deles) e feche num `session_shutdown` idempotente.

Exemplo mínimo da doc (extensions.md):
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Show a greeting",
    handler: async (name, ctx) => {
      ctx.ui.notify(`Hello, ${name || "world"}!`, "info");
    },
  });
}
```

#### Pontos de integração (tabela da doc)

| Capacidade | API |
|---|---|
| Observar ou modificar o lifecycle | `pi.on()`. Retorna uma função de unsubscribe. |
| Tool chamável pelo modelo | `pi.registerTool()` |
| Comando `/` | `pi.registerCommand()` |
| Atalho ou flag de CLI | `pi.registerShortcut()`, `pi.registerFlag()` / `pi.getFlag()` |
| Mensagens | `pi.sendUserMessage()`, `pi.sendMessage()` (custom message, `deliverAs: steer / followUp / nextTurn`) |
| Dado de sessão fora do contexto do modelo | `pi.appendEntry()` |
| Tools, modelo e thinking ativos | `pi.setActiveTools()`, `pi.getActiveTools()`, `pi.setModel()`, `pi.setThinkingLevel()` |
| Provider de modelo | `pi.registerProvider()` |
| Processo externo | `pi.exec(cmd, args, opts)` |
| Comunicação entre extensões | `pi.events` |

#### Eventos (`pi.on`), extraídos do `types.ts`

| Grupo | Eventos, e o que o handler pode retornar |
|---|---|
| Recursos e trust | `project_trust`; `resources_discover` retorna `{ skillPaths?, promptPaths?, themePaths? }` |
| Sessão | `session_start` (reason: `startup / reload / new / resume / fork`), `session_info_changed`, `session_before_switch`, `session_before_fork`, `session_before_compact` (pode `{ cancel }` ou fornecer `compaction`), `session_compact`, `session_compact_failed`, `session_before_tree`, `session_tree`, `session_shutdown` (reason: `quit / reload / new / resume / fork`) |
| Contexto e provider | `context` e `context_with_system` (retornam `{ messages }`, transformação válida só para aquela requisição), `before_provider_request`, `before_provider_headers`, `after_provider_response` |
| Agente | `before_agent_start` (retorna `{ systemPrompt?, message? }`), `agent_start`, `agent_end`, `agent_before_settle` (pode encadear entries e `continue: true`), `agent_settled` |
| Turno e mensagens | `turn_start`, `turn_end` (idem `agent_before_settle`), `message_start`, `message_update`, `message_end` (pode substituir a mensagem finalizada) |
| Tools | `tool_call` (pode mutar input ou bloquear), `tool_result` (composição encadeada), `tool_execution_start / update / end` |
| Outros | `input` (retorna `continue / transform / handled`), `user_bash`, `model_select`, `thinking_level_select`, `ui_prompt_start / end`, `cache_warming_decision` |

- **Concorrência:** os handlers rodam na ordem de carga e registro. O pi-hermes-memory depende disso: o `session_shutdown` que fecha o DB é registrado por último. Tool calls de uma mesma mensagem podem rodar em paralelo.
- **Erros:** o pi reporta o erro do handler e continua. Falha num handler de `tool_call` bloqueia a tool (fail-safe).

#### Registrar tools (formato do schema)

- Os parâmetros usam schema **TypeBox**.
- O resultado precisa de `content` (visível para o modelo) e `details` (para renderização e reconstrução de estado).
- `throw` gera um resultado de erro. `executionMode: "sequential"` serve para estado mutável compartilhado.
- Para tools que mutam arquivos, a doc recomenda `withFileMutationQueue()`.

Exemplo oficial (`examples/extensions/hello.ts`, https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts):
```ts
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    return { content: [{ type: "text", text: `Hello, ${params.name}!` }], details: { greeted: params.name } };
  },
});
export default function (pi: ExtensionAPI) { pi.registerTool(helloTool); }
```

Campos de `ToolDefinition` (types.ts):
- `name`, `label`, `description`
- `promptSnippet?` e `promptGuidelines?`, que o pi injeta no system prompt
- `parameters`, `prepareArguments?`, `executionMode?`
- `execute(toolCallId, params, signal, onUpdate, ctx)`
- `renderCall?` e `renderResult?`, com componentes pi-tui

#### Slash commands

`pi.registerCommand(name, { description?, getArgumentCompletions?, handler(args: string, ctx: ExtensionCommandContext) })`.

O `ExtensionCommandContext` acrescenta operações que **só** podem ser chamadas de dentro de comandos, sob risco de deadlock se chamadas em handlers de lifecycle:
- `waitForIdle()`
- `reload()`
- `newSession()`, `fork()`, `navigateTree()`, `switchSession()`
- `getSystemPromptOptions()`

#### Injetar ou modificar o system prompt e o contexto

- **`before_agent_start`** recebe `prompt`, `systemPrompt` (renderizado) e `systemPromptOptions` (estruturado, com `sections: Record<string,string>`, `contextFiles`, `skills`, `selectedTools`, `appendSystemPrompt`…).
  - A doc **prefere mutar seções**. Retornar `{ systemPrompt }` (ou usar `forceSystemPrompt`) **substitui o prompt inteiro naquele run**.
  - O resultado também aceita `{ message }`, que injeta uma custom message.
- Exemplo oficial com seções (`examples/extensions/prompt-customizer.ts`, https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/prompt-customizer.ts):
  ```ts
  pi.on("before_agent_start", (event) => {
    const guidance = buildToolGuidance(event.systemPromptOptions);
    if (guidance) event.systemPromptOptions.sections.tool_guidance = guidance;
    else delete event.systemPromptOptions.sections.tool_guidance;
  });
  ```
- **Ordem das seções do prompt padrão** (`src/core/system-prompt.ts`):
  1. `preamble`
  2. `tools`
  3. `rules`
  4. `docs`
  5. `addendum`
  6. `project_context`: AGENTS.md renderizados como `<project_instructions path="…">…</project_instructions>`
  7. `skills`: nome, descrição e path; entra só se houver tool `read`/`bash`
  8. `cwd`
- **`context`:** transforma as mensagens da requisição sem tocar no system prompt, e o pi restaura o estado depois. É o ponto natural para **retrieval por turno** sem invalidar o prefix cache do system prompt.
- **Cache:** mudanças de tools ou prompt no meio da sessão viram deltas no transcript. Providers que não os representam recebem um checkpoint completo, o que pode invalidar o prefixo em cache.

#### UI para prompts interativos (onboarding)

`ExtensionUIContext` (types.ts):
```ts
select(title: string, options: string[], opts?): Promise<string | undefined>;
confirm(title: string, message: string, opts?): Promise<boolean>;
input(title: string, placeholder?: string, opts?): Promise<string | undefined>;
editor(title: string, prefill?: string): Promise<string | undefined>;
notify(message: string, type?: "info" | "warning" | "error"): void;
setStatus(key, text); setWidget(key, lines, opts); setTitle(t); setWorkingMessage(m);
custom<T>(factory: (tui, theme, keybindings, done) => Component, options?): Promise<T>;
setEditorText(t); getEditorText(); pasteToEditor(t); /* + temas, footer/header, autocomplete */
```

- **Modos:**
  - No **interativo** (TUI) tudo funciona.
  - No **RPC**, diálogos e notificações são repassados ao cliente, mas **não** componentes custom.
  - **JSON/print** não têm UI.
- **Guardas:** use `ctx.hasUI` para diálogos (interativo e RPC) e `ctx.mode === "tui"` para `ctx.ui.custom()`.
- **Exemplos oficiais úteis:**
  - `question.ts`: select com opção de texto livre, feito com `ctx.ui.custom` e `Editor` do pi-tui
  - `questionnaire.ts`: tool `questionnaire` com várias perguntas e abas
  - `qna.ts`, `send-user-message.ts`
  - Todos em https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions
- O próprio pi-hermes-memory usa `ctx.ui.select` em `/learn-memory-tool` (≈L12):
  ```ts
  const section = await ctx.ui.select("Pi Hermes Memory Guide", ["📦 What Gets Saved", "🔧 Tools Available", /* … */], {});
  if (!section) return;
  ```

#### ExtensionContext (todo handler e tool)

- `cwd`, `mode`, `hasUI`, `ui`
- `sessionManager` (read-only; `getBranch()`, `getSessionFile()`…)
- `modelRegistry`, `model`, `signal`
- `isIdle()`, `abort()`, `shutdown()`, `compact()`, `getContextUsage()`, `getSystemPrompt()`
- Para chamadas de modelo aninhadas, a doc sugere `ctx.modelRegistry.streamSimple()`.

#### Onde ficam settings e estado

Diretório do agente: `~/.pi/agent`, sobrescrito por `PI_CODING_AGENT_DIR`. Fonte: `docs/configuration.md`.

| Caminho | Conteúdo |
|---|---|
| `settings.json` | settings do usuário, `packages`, `extensions`, `skills`, `prompts`, `themes`, `enableSkillCommands`, `sessionDir`… |
| `auth.json`, `models.json`, `keybindings.json` | credenciais, modelos e atalhos |
| `AGENTS.md` (ou `AGENTS.override.md` / `CLAUDE.md`) | instruções globais do usuário |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | substitui / acrescenta ao system prompt |
| `extensions/`, `skills/`, `prompts/`, `themes/` | recursos do usuário |
| `npm/`, `git/` | pacotes instalados |
| `sessions/` | sessões JSONL (árvore id/parentId), agrupadas por cwd. Override por `--session-dir`, `PI_CODING_AGENT_SESSION_DIR` ou `sessionDir`. |

No projeto, `.pi/` contém `settings.json`, `SYSTEM.md`, `APPEND_SYSTEM.md`, `extensions/`, `skills/`, `prompts/` e `themes/`. As settings de projeto se sobrepõem às do usuário e as listas de recursos são combinadas.

**Estado de extensão:**

| Tipo de estado | Onde guardar |
|---|---|
| Estado que segue o branch ativo | `details` do resultado da tool |
| Dado durável fora do contexto do modelo | `pi.appendEntry()` |
| Conteúdo que vai ao modelo | `pi.sendMessage()` |
| Dado entre sessões | **storage externo** (é o que o pi-hermes-memory faz) |

#### Descoberta de AGENTS.md e skills

- **Arquivos de contexto:** `AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md` e `CLAUDE.MD`, lidos do diretório do agente, do cwd e de **todos os diretórios pais**. Um `AGENTS.override.md` só substitui na mesma pasta.
- **Skills** (Agent Skills standard; https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md):
  - `SKILL.md` com frontmatter `name` (minúsculas, números e hífens, até 64) e `description` (até 1024). Opcionais: `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`.
  - Descoberta em:
    - `~/.pi/agent/skills`
    - `.pi/skills`
    - `~/.agents/skills`
    - `.agents/skills` (subindo até a raiz do repo)
    - pacotes e settings
    - o evento `resources_discover` → `skillPaths`
  - **Progressive disclosure:** o prompt recebe só nome, descrição e path; o modelo lê o `SKILL.md` sob demanda. O comando `/skill:name` força o carregamento.

#### Notas de Windows (docs/windows.md)

- A tool bash usa Git Bash por padrão (ou `shellPath`).
- Existe uma tool `powershell` opcional.
- Em JSON, barras invertidas precisam ser escritas em dobro.

### 1.4 Blocos para o onboarding (esboço próprio, **não testado**)

```ts
// ESBOÇO: combina APIs reais do pi (registerCommand, ctx.ui.*, ctx.reload)
pi.registerCommand("vault-memory-setup", {
  description: "Configurar vault(s) Obsidian para a memória",
  handler: async (_args, ctx) => {
    if (!ctx.hasUI) return ctx.ui.notify("Use em modo interativo", "warning");
    const vaults = await detectarVaults();            // ex.: pastas com .obsidian/ sob %OneDrive%
    const escolha = await ctx.ui.select("Vault principal", [...vaults, "Outro caminho…"]);
    if (!escolha) return;
    const vault = escolha === "Outro caminho…" ? await ctx.ui.input("Caminho do vault", "C:\\Users\\…\\OneDrive\\Vault") : escolha;
    const pasta = (await ctx.ui.input("Pasta da memória dentro do vault", "Agent Memory")) ?? "Agent Memory";
    if (!(await ctx.ui.confirm("Confirmar", `Gravar memória em ${vault}\\${pasta}?`))) return;
    await gravarConfigAtomico({ vaults: [{ path: vault, folder: pasta }] });
    await ctx.reload(); // re-executa os factories: a nova config entra em vigor sem reiniciar o pi
  },
});
// No session_start: se não houver config e ctx.hasUI, apenas notificar "/vault-memory-setup".
// ctx.reload() é exclusivo de comandos.
```

---

## Parte 2: pi-hermes-memory (a base a reutilizar)

### 2.1 Identidade

| Item | Valor |
|---|---|
| npm | `pi-hermes-memory`. https://www.npmjs.com/package/pi-hermes-memory · https://pi.dev/packages/pi-hermes-memory |
| Repo | https://github.com/chandra447/pi-hermes-memory. Criado em 2026-04-23, último push em 2026-09-14, 456 stars, 111 forks, 24 issues abertas (em 2026-09-23). Tópicos: context-engineering, harness, memory, pi. |
| Autor | chandra447 (Chandra Teja, conforme o LICENSE) |
| Licença | **MIT**, "Copyright (c) 2025 Chandra Teja". O README declara que o código foi portado do Hermes Agent, que é MIT, "Copyright (c) 2025 Nous Research". |
| Versão | **0.9.9**, publicada em **2026-09-13** (commit `71ce9f0`). Mais de 50 versões desde a 0.1.0. O CHANGELOG só tem cabeçalhos até **[0.9.4] (2026-08-08)**; o que veio depois está em "[Unreleased]". |
| Downloads | Pela API do npm: **21.582** entre 2026-08-23 e 2026-09-21, e **3.817** entre 2026-09-15 e 2026-09-21. A pi.dev mostra "27K/month · 5,497/week", com janela ou metodologia diferente **(não verificado)**. |
| Runtime | `"type": "module"`, `"main": "src/index.ts"`, manifest `"pi": { "extensions": ["./src/index.ts"] }`. O código-fonte TS é carregado via jiti; a issue #246 mede cerca de 2,1 s de import. |
| Dependências | `better-sqlite3 ^13.0.3` (nativa), `@earendil-works/pi-tui ^0.80.2`, `strip-ansi 7.2.0`. Peers: `@earendil-works/pi-ai >=0.80.6` e `@earendil-works/pi-coding-agent >=0.80.6`. Dev: `tsx`, `typebox`, `typescript ^6`. |
| Testes | A descrição fala em "732 tests". São cerca de 50 arquivos `tests/**/*.test.ts` com `node:test` via `npx tsx --test`, um processo por arquivo (`tests/run-all.sh`). O CI (`.github/workflows/ci.yml`) roda **só em ubuntu-latest** com Node 22: `check`, `check:min-sdk`, `test` e `lint` (este último é `git diff --exit-code`). **Não há CI em Windows.** |

### 2.2 Arquitetura em uma página

```
factory (index.ts, síncrono)
 ├─ loadConfig()  ← ~/.pi/agent/hermes-memory-config.json (lido 1x)
 ├─ globalDir = config.memoryDir ?? ~/.pi/agent/pi-hermes-memory
 ├─ MemoryStore(global) · SkillStore · DatabaseManager(globalDir → sessions.db) · StandingInstructions
 ├─ createMemoryInitializer(): migração → sync Markdown→SQLite → store.loadFromDisk() → prune → backfill de sessões
 │
 ├─ on session_start      → STANDING.md; ensureMemoryReady (se não lazy); contexto de skills do projeto
 ├─ on resources_discover → skillPaths = [<globalDir>/skills, <projeto>/skills]
 ├─ on before_agent_start → systemPrompt += buildPromptContext(...)   (policy OU blocos legacy) + standing
 ├─ tools: memory_add/replace/remove · memory_search · session_search · skill_manage
 ├─ on turn_end/message_end → background review (a cada 10 turnos ou 15 tool calls; não bloqueante)
 ├─ on message_end + turn_end → correction detector (regex → LLM → salva)
 ├─ on session_before_compact → flush (aguardado, até 60 s)
 ├─ on message_end → indexação incremental da sessão no SQLite
 └─ on session_shutdown   → flush (10 s) → indexa sessão final → fecha DB (wal_checkpoint TRUNCATE)
```

### 2.3 Mapa arquivo a arquivo

**Raiz e tooling**

| Arquivo | Propósito |
|---|---|
| `package.json` | Manifest pi, deps, scripts (`check`, `check:min-sdk`, `check:production`, `test`) |
| `README.md` | Docs de uso: tools, comandos, config, layout de storage, limitações |
| `CHANGELOG.md` | Histórico. O #218 (bypass do cap em policy-only), o #121 (standing) e o #227 (fingerprint por escopo) estão em "[Unreleased]". |
| `PLAN.md` | Plano da v0.1 com o "Hermes Source File Reference Map" (Hermes → arquivos TS) |
| `AGENTS.md` | Instruções para agentes que desenvolvem o repo. **Desatualizado:** ainda diz "No SQLite" e `~/.pi/agent/memory/`. |
| `docs/ROADMAP.md` | Análise competitiva vs Hermes e roadmap. Planeja `MemoryOrchestrator`/`MemoryBackend`/`ExternalSync` (v0.5), **não implementados**. |
| `docs/0.x/*` | PLAN, TASKS e TEST-PLAN de cada versão |
| `docs/PUBLISHING.md` | Processo de publicação |
| `docs/mermaid/*.mmd`, `docs/images/*` | Diagramas. Parcialmente desatualizados: ainda mostram `pi.exec("pi -p")` como caminho principal. |
| `scripts/*.mjs` | `ensure-dev` (bloqueia scripts de dev no pacote publicado), `check-min-sdk`, `check-production-install`, `benchmark-memory-startup` |
| `tests/run-all.sh`, `tests/**` | Suíte `node:test`: store, tools, handlers, integration |
| `.github/workflows/{ci,publish}.yml` | CI (ubuntu) e publicação |
| `.claude/agents/semble-search.md`, `.ralph/*` | Tooling de desenvolvimento do autor (subagent do Claude Code, estado de "ralph loop") |

**`src/` (núcleo)**

| Arquivo | Propósito |
|---|---|
| `index.ts` (≈422 linhas) | Entry point: carrega config, resolve diretórios, instancia os stores, registra eventos, tools e comandos, e cuida da ordem de shutdown |
| `config.ts` | `DEFAULT_CONFIG`, `DEFAULT_CONFIG_PATH` (`<AGENT_ROOT>/hermes-memory-config.json`) e `loadConfig()`, que valida tipo por chave e cai para os defaults em qualquer erro |
| `constants.ts` (≈313 linhas, cerca de 25 KB) | Delimitador, limites, nomes de arquivo, **todos os prompts** (policy full/compact, descrição das tools, review, flush, consolidation, correction, skill, interview) e padrões de correção |
| `types.ts` | `MemoryConfig` (todas as chaves), `MemoryResult`, `MemoryMutationOperation`, `MemoryCategory`, tipos de skill e `getMessageText()` |
| `paths.ts` | `AGENT_ROOT` (respeita `PI_CODING_AGENT_DIR`), `expandHome`, `normalizeConfiguredMemoryDir`, `normalizeProjectsMemoryDir` (restritivo) e `resolveProjectsRoot` |
| `project.ts` | `detectProject()`: nome do projeto = basename da raiz git (worktrees compartilham) ou do cwd. Diretório = `<projectsRoot>/<nome>`. `detectProjectSkills()`. |
| `project-context.ts` | Helpers para resolver as refs `projectStore` e `projectName` |
| `prompt-context.ts` | `resolveMemoryPolicyPrompt()` (full, compact, custom ou none) e `buildPromptContext()` (policy-only vs legacy, mais standing) |
| `memory-initialization.ts` | `createMemoryInitializer()` (init preguiçosa ou ansiosa, tracking de trabalho ativo, `close()`) e `withMemoryInitialization()`, que embrulha `registerTool` e `registerCommand` |
| `extension-root-migration.ts` | Migra `~/.pi/agent/memory` → `~/.pi/agent/pi-hermes-memory`, incluindo `sessions.db`, `-wal` e `-shm` com staging e sentinel |
| `project-memory-migration.ts` | Migra o layout antigo `~/.pi/agent/<projeto>/` para `projects-memory/` |
| `lifecycle-timing.ts` | `measureLifecycle*` (timing opt-in) |
| `auto-consolidation-warning.ts` | Decide se avisa quando a auto-consolidação falha |

**`src/store/` (persistência)**

| Arquivo | Propósito |
|---|---|
| `memory-store.ts` (cerca de 50 KB) | **`MemoryStore`**: CRUD por target (memory, user, failure), dedupe, metadados, limites e overflow, snapshot, render dos blocos, **escrita atômica com hard link/rename**, snapshots de recovery, detecção de edição externa (fingerprint) e plano de mutação atômico |
| `markdown-mutation-lock.ts` | Lock entre processos por arquivo Markdown via `AtomicLockCoordinator`, gravado em `<pai do diretório de memória>/.pi-hermes-locks.sqlite` |
| `atomic-lock-coordinator.ts` | Locks em SQLite (`BEGIN IMMEDIATE`) com lease, `staleMs`, PID vivo e "incarnation probe" (no Windows usa PowerShell; ver as issues #245 e #247) |
| `canonical-storage-path.ts` | Canonicaliza paths resolvendo symlinks (`realpathSync.native`) |
| `content-scanner.ts` | `scanContent()` e `scanSecrets()`: injeção, exfiltração, unicode invisível e segredos |
| `memory-lookup.ts` | `normalizeMemoryLookupText()`: aceita `old_text` colado de resultados formatados de busca |
| `db.ts` (cerca de 41 KB) | **`DatabaseManager`**: abre `<memoryDir>/sessions.db` com WAL, busy_timeout de 5 s, `quick_check` assíncrono, recuperação de corrupção (rebuild a partir das linhas legíveis), stats e `close()` com checkpoint |
| `schema.ts` | Tabelas `extension_metadata`, `sessions`, `session_files`, `messages`, `message_fts` (FTS5 trigram), `memories`, `memory_fts` (FTS5 trigram), triggers e índices |
| `sqlite-native.ts` | Loader do `better-sqlite3`: detecta divergência de ABI e tenta `npm rebuild` com `spawnSync`. Faz fallback para `bun:sqlite` no Bun. |
| `sqlite-memory-store.ts` (cerca de 36 KB) | Espelho SQLite da memória: `reconcileMarkdownMemoryScope`, `reconcileMarkdownFailureScopes` (fingerprints `mdsync:v1:`), `searchMemories` (FTS5 bm25 com fallback LIKE), `syncMemoryEntry` e `getRecentFailures`. **"Markdown is the source of truth".** |
| `fts-query.ts` | Normaliza consultas em linguagem natural para FTS5. A lista de stop-words é **só em inglês**. |
| `session-parser.ts` | Faz parse do JSONL de sessão do pi |
| `session-indexer.ts` | Indexa sessões e mensagens (sem tool results; mensagens truncadas em 100 KiB), backfill incremental (até 50 arquivos por rodada), retenção e poda |
| `session-search.ts` | Busca FTS5 em `message_fts` (variante "legacy") |
| `session-anchor-search.ts` | Variante "anchors": varre o JSONL diretamente, sem SQLite, a partir de um pedido em Markdown (`from/to/cwd/limit`, `all/any/exclude`) e devolve `path:start-end` |
| `skill-store.ts` (cerca de 35 KB) | **`SkillStore`**: `skills/<slug>/SKILL.md` global ou por projeto, frontmatter, seções (When to use, Procedure, Pitfalls, Verification), similaridade Jaccard e migração legada |
| `skill-utils.ts` | slugify e similaridade |
| `standing-instructions.ts` | **`StandingInstructions`**: `STANDING.md`, uma regra por linha, até 20 entradas / 2.000 caracteres, scan, render `<standing-instructions>`. A escrita é só humana (`/memory-pin`). |
| `recovery-maintenance.ts` | Varredura por sessão dos artefatos `.recovery-*` e `.retired-*` dos stores dormentes |

**`src/tools/`**

| Arquivo | Propósito |
|---|---|
| `memory-tool.ts` | `memory_add`, `memory_replace`, `memory_remove`, com sync ou reconcile para o SQLite depois de cada escrita |
| `memory-search-tool.ts` | `memory_search` |
| `session-search-tool.ts` | `session_search` nas variantes legacy e anchors |
| `skill-tool.ts` | `skill_manage` |
| `shared-output-view.ts`, `tool-result-views.ts` | Renderização TUI dos resultados |

**`src/handlers/`**

| Arquivo | Propósito |
|---|---|
| `background-review.ts` | Loop de aprendizado: `turn_end` com limiar, review não bloqueante (direto ou subprocess) |
| `review-memory-ops.ts` | Transporte direto (`completeSimple` de `@earendil-works/pi-ai/compat`), cadeia de modelos e fallbacks, parse do JSON `{"operations":[…]}` (inclusive quando a resposta vem só no canal de thinking) e `applyReviewOperations` |
| `pi-child-process.ts`, `child-process-watchdog.mjs` | Subprocess `pi -p --no-session --no-extensions -e <própria extensão + childExtensionPaths + auth adapters> @<arquivo de prompt>`, com watchdog de árvore de processos e retry sem overrides |
| `session-flush.ts` | Flush em `session_before_compact` (aguardado) e em `session_shutdown` |
| `correction-detector.ts` | Detecta correções do usuário por regex e salva de imediato |
| `auto-consolidate.ts` | `triggerConsolidation()`, com lock em `~/.pi/agent/pi-hermes-memory/.consolidation-locks/locks.sqlite`, e o comando `/memory-consolidate` |
| `sync-markdown-memories.ts` | Reconciliação Markdown → SQLite (inicial e `/memory-sync-markdown`) |
| `session-backfill.ts`, `session-live-index.ts`, `index-sessions.ts` | Backfill limitado no startup, indexação ao vivo (`message_end`) e `/memory-index-sessions` |
| `insights.ts` | `/memory-insights` |
| `interview.ts` | `/memory-interview` |
| `skills-command.ts` | `/memory-skills`, um modal `ctx.ui.custom` com pi-tui |
| `learn-memory.ts` | `/learn-memory-tool`, menu com `ctx.ui.select` |
| `preview-context.ts` | `/memory-preview-context` |
| `standing-pin.ts` | `/memory-pin [list / remove n / clear / <texto>]` |
| `switch-project.ts` | `/memory-switch-project`: lista as memórias de projeto |
| `message-parts.ts` | Utilitários de partes de mensagem |

### 2.4 Onde a memória é gravada, como os paths são resolvidos e o formato

**Raiz do agente** (`src/paths.ts`, ≈L5-10):
```ts
export const AGENT_ROOT = resolveAgentRoot();
export function resolveAgentRoot(env = process.env): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim();
  return configured ? path.resolve(expandHome(configured)) : path.join(os.homedir(), ".pi", "agent");
}
```

**Diretório global** (`src/index.ts`, factory ≈L89-100). `memoryDir` pode vir da config como caminho absoluto, `~` ou relativo ao `AGENT_ROOT`:
```ts
const legacyGlobalDir = path.join(agentRoot, "memory");
const defaultGlobalDir = path.join(agentRoot, "pi-hermes-memory");
const configuredMemoryDir = config.memoryDir?.trim();
const globalDir = !configuredMemoryDir || pointsToLegacyMemoryDir ? defaultGlobalDir : configuredMemoryDir;
```

**Arquivos por target** (`src/store/memory-store.ts`, `pathFor()` ≈L86-90):
```ts
if (target === "user") return path.join(this.memoryDir, USER_FILE);          // USER.md
if (target === "failure") return path.join(this.memoryDir, "failures.md");
return path.join(this.memoryDir, MEMORY_FILE);                                // MEMORY.md
```
- O target `project` da tool é o target `memory` de um **segundo** `MemoryStore`, cujo `memoryDir` é o diretório do projeto (`createProjectStore()` em index.ts).
- Esse store é religado a cada `ctx.cwd`, via `bindProjectFromCwd()` em `session_start` e em cada `execute` das tools.

**Projeto** (`src/project.ts`, `detectProject()` ≈L92-116):
- `memoryDir = <AGENT_ROOT>/<projectsMemoryDir>/<nome>`, com padrão `projects-memory`.
- O nome é o basename da raiz git. Linked worktrees compartilham identidade. Existe uma ponte para o nome antigo derivado do cwd.
- `cwd == home` significa "sem projeto".
- `normalizeProjectsMemoryDir()` (paths.ts ≈L34-57) **rejeita** qualquer caminho absoluto fora de `AGENT_ROOT` e exige **um único segmento**. Hoje, portanto, não dá para mandar a memória de projeto para o OneDrive via config.

**Constantes** (`src/constants.ts` ≈L1-70):
```ts
export const ENTRY_DELIMITER = "\n§\n";           // igual ao Hermes
export const DEFAULT_MEMORY_CHAR_LIMIT = 5000;    // "Character limits (not tokens — model-independent)"
export const DEFAULT_USER_CHAR_LIMIT = 5000;
export const DEFAULT_PROJECT_CHAR_LIMIT = 5000;
export const MEMORY_FILE = "MEMORY.md"; export const USER_FILE = "USER.md"; export const STANDING_FILE = "STANDING.md";
export const STANDING_MAX_ENTRIES = 20; export const STANDING_MAX_CHARS = 2000;
```

**Metadados por entrada** (`encodeEntry()`, memory-store.ts ≈L532):
```ts
return `${text} <!-- created=${created}, last=${lastReferenced}${projectMetadata} -->`; // project64=<base64url>
```
- `decodeEntry()` interpreta o comentário por regex. Entradas sem metadados assumem "hoje".
- Nas falhas, o texto é prefixado com `[categoria]` e partes como `— Failed: … — Tool state: … — Corrected to: …` (`buildFailureMemoryText`).

Exemplo **ilustrativo** de `MEMORY.md`, montado a partir das regras acima (não é um arquivo real):
```md
Projeto usa pnpm, não npm <!-- created=2026-09-01, last=2026-09-20 -->
§
CI exige --frozen-lockfile <!-- created=2026-09-02, last=2026-09-02 -->
```

**Leitura e escrita** (memory-store.ts):
- **`loadFromDisk()`** (≈L148-166):
  - `mkdir -p`
  - para cada target: `readFileState()`, que faz `split(ENTRY_DELIMITER)`, `trim`, `filter` e dedupe via `Set`, e calcula um fingerprint SHA
  - captura o **snapshot** (MEMORY e USER sem metadados) para o modo `legacy-inject`
- **`runTargetMutation()`:** pega o lock (`withMarkdownMutationLock`), aplica a mutação, verifica que o fingerprint em disco não mudou e, se mudou, tenta de novo até 2 vezes (`ExternalMemoryWriteConflict`). Só depois chama o observer, que reconcilia o SQLite.
- **`saveToDisk()`** (≈L766+). Algoritmo:
  1. `mkdtemp(<dir>/.tmp-XXXX)` e escreve `write.tmp`.
  2. Relê o alvo e compara o fingerprint.
  3. Poda os arquivos de recovery.
  4. Publica:
     - se o arquivo não existe: `fs.link(tmp, alvo)`, isto é, **hard link**;
     - se houve snapshot recente (1 h): `fs.rename(tmp, alvo)`;
     - senão: `rename(alvo → .MEMORY.md.recovery-<ts>-<uuid>)`, depois `fs.link(tmp, alvo)`, e reverifica.
  5. Em conflito cria `.<arquivo>.conflict-local-<ts>-<uuid>` e faz rollback.
  6. Limpa o temp e verifica o fingerprint publicado.
  - Retenção: `RECOVERY_MAX_COUNT=32`, `RECOVERY_MAX_BYTES=64 MiB`, conflito e retired com 30 dias.
  - Artefatos no diretório da memória: `.tmp-*/`, `.MEMORY.md.recovery-*`, `.*.retired-*`, `.*.conflict-local-*`.

**Outros arquivos e diretórios gravados:**

| Caminho | O que é |
|---|---|
| `<globalDir>/sessions.db` (+ `-wal`, `-shm`) | `new DatabaseManager(globalDir)` em index.ts ≈L117. Pragmas: `journal_mode=WAL`, `busy_timeout=5000`, `wal_autocheckpoint=1000`, `journal_size_limit=5 MiB`, `foreign_keys=ON`. |
| `<pai do diretório de memória>/.pi-hermes-locks.sqlite` | markdown-mutation-lock.ts ≈L14-15: `const coordinatorDir = path.dirname(path.dirname(identity));` e depois `AtomicLockCoordinator.shared(path.join(coordinatorDir, ".pi-hermes-locks.sqlite"))`. Em instalação padrão isso dá `~/.pi/agent/.pi-hermes-locks.sqlite` e `~/.pi/agent/projects-memory/.pi-hermes-locks.sqlite`. |
| `~/.pi/agent/pi-hermes-memory/.consolidation-locks/locks.sqlite` | Fixo no `AGENT_ROOT` (não segue `memoryDir`). Override via env `PI_HERMES_CONSOLIDATION_LOCK_DIR`. |
| `<globalDir>/skills/<slug>/SKILL.md` e `<projeto>/skills/<slug>/SKILL.md` | Skills, expostas ao pi via `resources_discover` |
| `<globalDir>/STANDING.md`, `<globalDir>/.skills-migrated-to-extension-storage` | Standing instructions e sentinel de migração |
| `~/.pi/agent/hermes-memory-config.json` | Config |
| `~/.pi/agent/sessions/**.jsonl` | **Leitura** das sessões do pi para indexação |

### 2.5 Limites de tamanho: constantes, onde são aplicados e o que acontece

Aplicação (memory-store.ts ≈L114-121):
```ts
private charLimit(target) {
  if (target === "failure") return this.config.memoryCharLimit * 2;
  return target === "user" ? this.config.userCharLimit : this.config.memoryCharLimit;
}
private get capEnforced(): boolean { return this.config.memoryMode !== "policy-only"; }
```

Verificação em `_add()` (≈L246-257). Há checagens equivalentes em `replaceUnlocked()` e `applyMutationPlan()`:
```ts
const newTotal = [...entries, encoded].join(ENTRY_DELIMITER).length;
if (this.capEnforced && newTotal > limit) {
  this.overflowSince[target] ??= Date.now();
  if (strategy === "fifo-evict") return this.fifoEvictAndAdd(/* … */);
  return this.memoryFullError(target, content.length);
}
```

**Estratégia de overflow** (config `memoryOverflowStrategy`, só em `legacy-inject`):
- **`reject`:** devolve o erro "Memory at X/Y chars. Adding this entry (N chars) would exceed the limit. Replace or remove existing entries first…", acompanhado da lista de entradas.
- **`fifo-evict`:** remove as entradas mais antigas até caber e devolve `evicted_entries`.
- **`auto-consolidate`** (padrão):
  - `addWithConsolidation()` espera `overflowGraceMs` (180 s) para dar chance ao usuário de consolidar manualmente;
  - depois chama o consolidator injetado (`store.setConsolidator(...)` em index.ts);
  - o consolidator roda sob lock uma chamada LLM direta, com JSON de operações e `requireShrink`, ou um `pi -p`;
  - em seguida recarrega do disco e tenta de novo uma vez.

**Tabela de todos os limites encontrados:**

| Limite | Valor | Configurável? | Onde |
|---|---|---|---|
| MEMORY.md, USER.md, projeto | 5.000 caracteres cada | sim: `memoryCharLimit`, `userCharLimit`, `projectCharLimit` | constants.ts, config.ts, `charLimit()`. **Só aplicado em `legacy-inject`.** |
| failures.md | 2 × memoryCharLimit | indireto | `charLimit()` |
| STANDING.md | 20 entradas / 2.000 caracteres | **não** (constantes) | `standing-instructions.ts` `add()` |
| Mensagem de sessão indexada | 100 KiB | não | `DEFAULT_MAX_MESSAGE_CONTENT_LENGTH` |
| `memory_search` | padrão 10, máximo 20 resultados | por chamada | memory-search-tool.ts |
| `session_search` (legacy) | limit 1-20 (padrão 10); snippet 1.200 (máximo 4.000); saída até 50 KiB | por chamada | session-search-tool.ts |
| Falhas injetadas | 5 entradas, até 7 dias | sim: `failureInjection*` | só em `legacy-inject` |
| Backfill no startup | 50 arquivos por rodada | não | session-indexer.ts |
| Retenção de sessões | 0 (desligada) | sim: `sessionRetentionDays` | config |
| Recovery, retired, conflict | 32 arquivos / 64 MiB / 7 a 30 dias | não | memory-store.ts |

> **Importante:** no modo padrão `policy-only` os caps de Markdown **não** valem. O CHANGELOG em "[Unreleased]", item #218, diz que o SQLite é a "query authority" e que add, replace e planos atômicos podem passar do limite "without triggering automatic consolidation". Os limites ainda aparecem como `usage: "NN% — X/Y chars"` nas respostas (`successResponse`).

### 2.6 Tools expostas ao LLM

| Tool | Parâmetros (TypeBox) | Comportamento |
|---|---|---|
| `memory_add` | `target` ∈ {memory, user, project, failure}; `content`; `category?` ∈ {failure, correction, insight, preference, convention, tool-quirk}; `failure_reason?` | Faz scan e verifica duplicata exata (ignorando metadados). Grava no Markdown e depois sincroniza ou reconcilia o SQLite. `failure` vira `addFailure()` com o prefixo `[categoria]`. |
| `memory_replace` | `target`; `old_text` (substring); `content` | Exige **um** match. Recusa se o conteúdo novo omitir linhas de uma entrada multilinha (`validateWholeEntryReplacement`). Preserva o `created` e atualiza o `last`. |
| `memory_remove` | `target`; `old_text` | Exige **um** match (exceto cópias de falha em escopos distintos) |
| `memory_search` | `query`; `project?`; `target?` ∈ {memory, user, failure, project}; `category?`; `limit?` | FTS5 trigram, ordenado por bm25 e depois `last_referenced`, com fallback LIKE para CJK curto ou só stop-words. Rotula cada item com o `[target=…]` exigido por replace e remove. |
| `session_search` (legacy) | `query`; `project?`; `role?` ∈ {user, assistant}; `limit?` (1-20); `snippetChars?` (≤4000) | FTS5 sobre `messages` |
| `session_search` (anchors, opt-in) | `markdown` (pedido com `from/to/cwd/limit`, `all/any/exclude`) | Varre o JSONL e devolve âncoras `arquivo:linhas` |
| `skill_manage` | `action` ∈ {create, view, patch, update, edit, delete}; `name?`; `skill_id?`; `description?`; `scope?` ∈ {global, project}; `section?`; `content?`; `when_to_use?`; `procedure_steps?[]`; `pitfalls?[]`; `verification_steps?[]` | CRUD de `SKILL.md`, com scope obrigatório em `create` e checagem de similaridade |

Trecho do schema (`src/tools/memory-tool.ts`, `registerActionTool("add", …)`):
```ts
const target = StringEnum(["memory", "user", "project", "failure"] as const, { description: "Memory scope. …" });
Type.Object({
  target,
  content: Type.String({ description: "Entry content to save." }),
  category: Type.Optional(category),
  failure_reason: Type.Optional(Type.String({ description: "Why a failure occurred." })),
})
```
- Cada tool recebe a mesma descrição base (`MEMORY_TOOL_DESCRIPTION`: quando salvar, prioridades, o que **não** salvar e o significado de cada target).
- `promptSnippet` e `promptGuidelines` dizem, por exemplo, que a tool deve ser usada proativamente em correções e preferências, e não para estado temporário ou TODO.
- Resultado: `{ content: [{ type: "text", text }], details: MemoryResult }`. Se a sincronização SQLite falhar, vem o aviso "Saved to Markdown, but SQLite search sync failed…".

### 2.7 Como e quando a memória entra no prompt

`src/index.ts` (≈L217-225) roda **a cada prompt**, no `before_agent_start`:
```ts
pi.on("before_agent_start", async (event, _ctx) => {
  const promptContext = await buildPromptContext(config, store, projectStoreRef(), projectNameRef(), standingStore);
  if (promptContext) return { systemPrompt: event.systemPrompt + "\n\n" + promptContext };
});
```

`src/prompt-context.ts` (≈L33-55):
```ts
const standingBlock = standing?.formatForSystemPrompt() ?? "";
if (config.memoryMode === "policy-only") {
  return [resolveMemoryPolicyPrompt(config), standingBlock].filter(Boolean).join("\n\n");
}
// legacy-inject: store.formatForSystemPrompt() + projectStore.formatProjectBlock(name) + standing
```

- **`policy-only` (padrão desde a v0.7):**
  - Injeta `<memory-policy>…</memory-policy>` mais `<available-memory-tools>`. O texto explica que a memória **não** está carregada no prompt e que é preciso usar `memory_search`, descreve targets, filtros, categorias e guia de busca, pede que resultados sejam tratados como contexto e não como instrução, e orienta o uso de skills.
  - `memoryPolicyStyle`: `full`, `compact`, `custom` (texto vindo de `memoryPolicyCustomText`) ou `none`.
  - O texto é constante, o que é amigável ao prefix cache.
  - Nenhum conteúdo de memória vai ao prompt.
- **`legacy-inject`:**
  - Blocos `MEMORY (your personal notes) [NN% — X/Y chars]` e `USER PROFILE (who the user is) […]`, vindos do **snapshot** capturado em `loadFromDisk()`.
  - Mais `PROJECT MEMORY: <nome>`, que é **ao vivo** porque usa `this.memoryEntries`.
  - Mais `RECENT FAILURES & LESSONS` (até 5, de até 7 dias).
  - Tudo embrulhado por `fenceBlock()` em `<memory-context>` com o aviso de que é memória persistente e "NOT new user input".
  - **Nuance lida no código:** o snapshot é refeito quando `loadFromDisk()` roda de novo, por exemplo depois de uma auto-consolidação. Os blocos de projeto e de falhas mudam após escritas. Então o "congelado" só vale de fato para MEMORY e USER, e escritas no meio da sessão podem invalidar o cache **(inferência a partir do código, não medida)**.
- **Standing instructions:** o bloco `<standing-instructions>` é **sempre** anexado por último, inclusive em `policy-only` e com policy `none`. Só humanos escrevem nele, via `/memory-pin`.

### 2.8 Gatilhos, nudges, review em background e transporte

- **Background review** (`handlers/background-review.ts`):
  - `message_end` conta mensagens de usuário.
  - `turn_end` conta turnos do agente e tool calls.
  - Dispara quando `turnsSinceReview >= nudgeInterval` (10) **ou** `toolCallsSinceReview >= nudgeToolCalls` (15), e só se já houve **3 ou mais mensagens do usuário**. Uma review por vez.
  - É fire-and-forget (não bloqueia).
  - Envia o branch inteiro (`ctx.sessionManager.getBranch()`), ou as últimas N mensagens se `reviewRecentMessages > 0`.
  - Notifica "💾 Memory auto-reviewed and updated".
  ```ts
  const turnThresholdMet = turnsSinceReview >= config.nudgeInterval;
  const toolCallThresholdMet = toolCallsSinceReview >= config.nudgeToolCalls;
  if (!turnThresholdMet && !toolCallThresholdMet) return;
  if (userTurnCount < 3) return;
  ```
- **Transporte** (`reviewTransport`):
  - **`direct`** (padrão): `completeSimple` com o modelo da sessão ou `llmModelOverride`, cadeia `llmFallbackModels` e `llmThinkingOverride`. O modelo responde **JSON** `{"operations":[{action,target,content,old_text,category,failure_reason}]}`. Há recuperação quando a resposta sai no canal de thinking; nesse caso só adds não finais são aceitos.
  - **`subprocess`:** `pi -p --no-session --no-extensions -e <extensão> @prompt`, em que o filho usa as próprias tools de memória.
  - O `direct` cai para o `subprocess` quando falha.
  - Os prompts vêm de `constants.ts`: `DIRECT_REVIEW_SYSTEM_PROMPT`, `COMBINED_REVIEW_PROMPT`, `DIRECT_FLUSH_SYSTEM_PROMPT`, `DIRECT_CONSOLIDATION_SYSTEM_PROMPT`, `DIRECT_CORRECTION_SYSTEM_PROMPT`.
  - O review **não** cria skills ("Do NOT create or modify skills").
  - **Esses prompts não são configuráveis.** A issue #229 pede `review.customInstructions`, justamente para cooperar com um vault Obsidian ou wiki externo.
- **Correction detector** (`handlers/correction-detector.ts`):
  - `message_end` marca a mensagem do usuário.
  - Ordem de checagem: padrões *negative* (`^no worries`…), depois *strong* (`don't do that`, `^I said`…), depois *weak* (`^no,`, `^actually,`…) acompanhados de uma *directive word* (`use`, `run`, `install`…).
  - No `turn_end` roda o LLM (direct ou subprocess com 30 s) e grava também uma falha `[correction]`.
  - Limite de uma correção a cada 3 turnos. Notifica "🔧 Correction detected — memory updated".
  - Todos os padrões podem ser sobrescritos por config (`correction*Patterns`, `correctionDirectiveWords`), mas são em inglês.
- **Session flush** (`handlers/session-flush.ts`):
  - `session_before_compact`: **aguardado** até `flushCompactTimeoutMs` (60 s), só se houve 6 ou mais mensagens do usuário (`flushMinTurns`).
  - `session_shutdown`: limite fixo de 10 s; é pulado quando `reason === "reload"`.
- **Auto-consolidação:** só roda quando uma escrita estoura o cap, ou seja, só em `legacy-inject`. Existe também o comando manual `/memory-consolidate`.

### 2.9 Busca de sessões e indexação

- **Indexação:**
  - no shutdown, a sessão ativa;
  - ao vivo, em `message_end` (`scheduleLiveSessionIndex`);
  - no startup, um backfill limitado (50 arquivos, do mais novo para o mais antigo, só por stat);
  - manual, via `/memory-index-sessions`.
- **Tabelas:** `sessions`, `session_files`, `messages` (roles user, assistant e system; **sem tool results**) e `message_fts` (FTS5 `tokenize='trigram'`).
- **Retenção:** opcional (`sessionRetentionDays`). Sessões efêmeras de review são podadas.
- **⚠️ Possível bug no Windows (inferência, não testado):** `session-indexer.ts` (≈L27 e ≈L165) deriva o projeto com `project: header.cwd.split('/').pop() ?? header.cwd`. Com cwd `C:\Users\…\proj` não há `/`, então o "projeto" vira o caminho inteiro. Isso diverge de `detectProject()`, que usa basename.

### 2.10 Segurança: scanner de conteúdo

`src/store/content-scanner.ts` é portado de `_MEMORY_THREAT_PATTERNS`, `_INVISIBLE_CHARS` e `_scan_memory_content` do Hermes, com padrões de segredo vindos de "pk-pi-hermes-evolve". Bloqueia a escrita, devolvendo erro para a tool, quando encontra:

| Categoria | Exemplos |
|---|---|
| Unicode invisível | U+200B-U+200D, U+2060, U+FEFF, U+202A-U+202E |
| Padrões de ameaça | `ignore (previous|all…) instructions`, `you are now`, `do not tell the user`, `system prompt override`, `disregard … rules`, `curl/wget … $KEY/TOKEN…`, `cat … .env/.netrc/.npmrc…`, `authorized_keys`, `~/.ssh` |
| Segredos | `sk-ant-api…`, `sk-or-v1-…`, `sk-…`, `AKIA…`, `ghp_`, `ghu_`, `xoxb-`, `xapp-`, `ntn_`, `Bearer …`, blocos `-----BEGIN … PRIVATE KEY-----`, nomes de env (`ANTHROPIC_API_KEY`, `DATABASE_URL`…) e atribuições `password=`, `secret=`, `token=` |

```ts
if (pattern.test(content)) {
  return `Blocked: content matches threat pattern '${id}'. Memory entries may be surfaced …`;
}
```

O scanner é aplicado em memory, user, project, failure, skills e `STANDING.md`.

### 2.11 Configuração (`~/.pi/agent/hermes-memory-config.json`)

- O arquivo é lido **uma vez** no factory (`loadConfig()`).
- Cada chave é validada por tipo. Chaves desconhecidas são ignoradas.
- **Qualquer erro de parse faz o carregamento voltar silenciosamente aos defaults** (config.ts ≈L218-221).
- Não há escrita de config, UI nem versionamento.

| Chave | Padrão | Nota |
|---|---|---|
| `memoryMode` | `policy-only` | ou `legacy-inject` |
| `memoryPolicyStyle` / `memoryPolicyCustomText` | `full` / — | `full`, `compact`, `custom` ou `none` |
| `memoryCharLimit` / `userCharLimit` / `projectCharLimit` | 5000 cada | caps (só legacy) |
| `memoryOverflowStrategy` / `autoConsolidate` / `overflowGraceMs` | `auto-consolidate` / true / 180000 | `autoConsolidate` é alias legado |
| `memoryDir` | `~/.pi/agent/pi-hermes-memory` | absoluto, `~` ou relativo ao `AGENT_ROOT` |
| `projectsMemoryDir` | `projects-memory` | **um segmento, sob o `AGENT_ROOT`** |
| `lazyInitialization` | false | só vale em policy-only |
| `reviewEnabled` / `reviewTransport` / `nudgeInterval` / `nudgeToolCalls` / `reviewRecentMessages` | true / `direct` / 10 / 15 / 0 | |
| `flushOnCompact` / `flushOnShutdown` / `flushMinTurns` / `flushRecentMessages` / `flushCompactTimeoutMs` | true / true / 6 / 0 / 60000 | |
| `correctionDetection` e `correctionStrongPatterns` / `WeakPatterns` / `NegativePatterns` / `DirectiveWords` | true / defaults | regex como string |
| `failureInjectionEnabled` / `MaxAgeDays` / `MaxEntries` | true / 7 / 5 | só legacy |
| `consolidationTimeoutMs` / `autoConsolidationWarnOnFailure` | 180000 / true | |
| `standingInstructionsEnabled` | true | |
| `sessionSearch.variant` | `legacy` | ou `anchors` |
| `sessionRetentionDays` / `quickCheckOnOpen` | 0 / true | |
| `llmModelOverride` (string ou array) / `llmFallbackModels` / `llmThinkingOverride` / `childExtensionPaths` | — | aliases: `llmModelFallbacks`, `fallbackModels` |

**Variáveis de ambiente:**
- `PI_CODING_AGENT_DIR`
- `PI_CODING_AGENT_SESSION_DIR` (CHANGELOG 0.7.21)
- `PI_HERMES_CONSOLIDATION_LOCK_DIR`
- `PI_HERMES_CONSOLIDATION_LOCK_WAIT_MS`

### 2.12 Comandos e o "onboarding" que já existe

| Comando | Função |
|---|---|
| `/memory-insights` | Mostra a memória e o perfil |
| `/memory-skills` | Gerenciador de skills (modal TUI) |
| `/memory-consolidate` | Consolidação manual |
| `/memory-interview` | Onboarding do **perfil** (não de configuração) |
| `/memory-switch-project` | Lista as memórias de projeto |
| `/memory-index-sessions` | Importa sessões antigas |
| `/memory-sync-markdown` | Reconcilia Markdown → SQLite |
| `/memory-preview-context` | Mostra o que é injetado |
| `/memory-pin` | Standing instructions |
| `/learn-memory-tool` | Guia interativo (select) |

O `/memory-interview` (`handlers/interview.ts`) é o único onboarding:
```ts
pi.registerCommand("memory-interview", {
  description: "Answer a few questions to pre-fill your user profile …",
  handler: async (_args, ctx) => {
    // (avisa via ctx.ui.notify se já houver entradas em USER.md)
    await ctx.waitForIdle();
    pi.sendUserMessage(INTERVIEW_PROMPT); // LLM pergunta 7 itens, um por vez, e salva cada resposta com memory_add(target:"user")
  },
});
```

### 2.13 Issues e PRs abertos relevantes para o novo projeto (em 2026-09-23)

| # | Tipo | Assunto | Por que importa |
|---|---|---|---|
| #229 | issue | `review.customInstructions` para cooperar com stores externos, citando um vault "pi-llm-wiki" e entradas enxutas com `[[wikilink]]` | É exatamente o caso de uso Obsidian. O relato mostra memória crescendo de 4.709 para 11.247 caracteres em um dia. |
| #175 | PR | Busca semântica opcional via **qmd** (`@tobilu/qmd`) com fallback para FTS5 | Retrieval semântico local sobre Markdown |
| #216 | PR | "Active recall" opt-in no início da sessão: até 3 leads injetados em `before_agent_start` | Modelo de injeção por retrieval |
| #245 / #247 | issue / PR | Probe de "incarnation" do lock coordinator abre `powershell.exe` no load (cerca de 515 ms, sempre dá timeout no Windows) | Penalidade de startup **no Windows** |
| #211 | issue | Auto-consolidação não resolve o CLI filho no Windows (OMP standalone) | Subprocess no Windows |
| #246 | issue | Entry point em TS custa cerca de 2,1 s de import; propõe distribuir `dist/` | Startup |
| #238 | PR | Limitar snippets do `session_search` (truncamento UTF-16) | |

### 2.14 SEAMS: o que mudar para os três objetivos

#### Veredito sobre o storage

- **Não há interface ou adapter de storage.** A persistência está codificada em quatro classes concretas:
  - `MemoryStore`: `node:fs/promises` com `mkdir`, `readFile`, `writeFile`, `mkdtemp`, `link`, `rename`, `unlink`, `rm` e `lstat`
  - `SkillStore`: fs
  - `StandingInstructions`: fs
  - `DatabaseManager`: `better-sqlite3`
- Os paths são decididos em `paths.ts`, `project.ts`, `index.ts`, `markdown-mutation-lock.ts`, `auto-consolidate.ts` e `sync-markdown-memories.ts`.
- **Os únicos pontos de injeção existentes:**
  - `MemoryStore.setConsolidator()` e `setMutationObserver()`
  - as refs `ProjectStoreRef` / `ProjectNameRef`
  - `withMemoryInitialization()`
  - `config.memoryDir`
  - `memoryPolicyStyle: "custom"` (troca o texto da policy sem mexer no código)
- **Corte natural para um `MemoryBackend`:** separar a lógica de negócio que opera sobre `entries[]` (`_add`, `replaceUnlocked`, `removeUnlocked`, `applyMutationPlan`, dedupe, metadados, scan) da persistência (`resolveStoragePath`, `readFileState`, `saveToDisk`, `pruneRecoveryFiles`, `maintainRecoveryFiles`, `getStorageIdentity` e o lock). Os testes existentes (`tests/store/memory-store.test.ts`, cerca de 93 KB) servem de rede de segurança.

#### (a) Gravar dentro de um ou mais vaults Obsidian no OneDrive

**O que dá para fazer só com config hoje:**
- `"memoryDir": "C:/Users/<você>/OneDrive/<Vault>/Agent Memory"`.
- **Efeito colateral:** vão também para o vault `sessions.db`, `-wal` e `-shm`, os `.tmp-*`, `.recovery-*`, `.retired-*` e `.conflict-local-*`, `skills/`, `STANDING.md`, **e** o `.pi-hermes-locks.sqlite` na **raiz do vault**, que é o pai de "Agent Memory".
- **A memória de projeto continua em `~/.pi/agent/projects-memory/`.**

**Mudanças necessárias, arquivo por arquivo:**

| Arquivo / função | Mudança |
|---|---|
| `config.ts` (`DEFAULT_CONFIG`, `loadConfig`) e `types.ts` (`MemoryConfig`) | Novas chaves: `vaults[]` ({id, path, folder}), regras de roteamento (target, projeto ou glob de cwd → vault/pasta), `indexDir` e `lockDir` **fora** do OneDrive, e opções de formato. Manter `memoryDir` por compatibilidade. Trocar o fallback silencioso por erros visíveis. |
| `paths.ts` (`normalizeProjectsMemoryDir`, `resolveProjectsRoot`) | Permitir raiz absoluta, ou uma raiz por vault |
| `project.ts` (`detectProject`, `detectProjectSkills`) | Mapear projeto → vault/pasta em vez de `<AGENT_ROOT>/projects-memory/<nome>` |
| `index.ts` (factory: `globalDir`, `legacyGlobalDir`, `shouldMigrateExtensionRoot`, `new MemoryStore`, `new SkillStore`, `new DatabaseManager(globalDir)`, `new StandingInstructions(...)`, `createProjectStore`, `bindProjectFromCwd`) | Instanciar os backends por vault; **separar o caminho do DB** do caminho da memória; desligar migrações legadas no modo vault |
| `store/memory-store.ts` (`memoryDir`, `pathFor`, `resolveStoragePath`, `loadFromDisk`, `readFileState`, `saveToDisk`, `restoreDisplacedFile`, `rollbackPublishedFile`, `recoveryPathFor`, `pruneRecoveryFiles`, `retireRecoveryFile`, `preserveConflictFile`, `maintainRecoveryFiles`) | Extrair um `MemoryBackend`. Opcionalmente um formato "Obsidian-native", como uma nota por memória com frontmatter (id, target, category, project, created, updated, tags). Evitar hard links no OneDrive. |
| `store/markdown-mutation-lock.ts` (`acquireMarkdownMutationLock`) | O lock DB hoje é gravado em `dirname(dirname(arquivo))`; deve ir para `lockDir` local |
| `store/db.ts` (`DatabaseManager`) | Aceitar `dbPath` explícito, por exemplo em `%LOCALAPPDATA%` ou `~/.pi/agent/...`, reconstruível a partir do vault |
| `handlers/sync-markdown-memories.ts` (`syncMarkdownMemoriesToSqlite`, `scanProjectDirs`, `migrateThenSyncMarkdownMemories`), `store/recovery-maintenance.ts` (`listMemoryStoreDirs`) | Iterar pelos escopos e vaults do backend em vez de varrer `globalDir` e `projects-memory/` |
| `store/sqlite-memory-store.ts` (reconcile e search) | Acrescentar a dimensão `vault` e mudar o prefixo `MDSYNC_METADATA_KEY_PREFIX` se o parser mudar |
| `store/skill-store.ts`, `store/standing-instructions.ts` | Decidir se skills e STANDING vão para o vault. Skills em vault são interessantes, porque o pi as descobre via `resources_discover`. |
| `extension-root-migration.ts`, `project-memory-migration.ts`, `SkillStore.migrateLegacySkills()` | Pular no modo vault |
| `handlers/switch-project.ts`, `insights.ts`, `preview-context.ts` | Mostrar o vault e o caminho ativos |
| `store/session-indexer.ts` (`header.cwd.split('/')`) | Usar `path.basename` ou `detectProject` (Windows) |
| `constants.ts` (prompts) | Policy e review cientes do vault: wikilinks, notas enxutas. A policy pode ser trocada por `memoryPolicyStyle:"custom"`; os prompts de review exigem código (ver a issue #229). |

**Riscos de OneDrive e Windows a tratar:**

| Risco | Origem | Mitigação sugerida |
|---|---|---|
| SQLite (`sessions.db` com WAL/SHM e os dois `locks.sqlite`) numa pasta sincronizada: corrupção ou cópias de conflito | `DatabaseManager(globalDir)` e lock DB no pai do diretório de memória | Índices e locks sempre em disco local; o vault guarda só Markdown |
| `fs.link` (hard link) e `rename` com o OneDrive segurando handles ou arquivos "Files On-Demand" (placeholders). Só `ENOENT` e `EEXIST` são tratados; `EPERM`/`EBUSY` viram erro. | `saveToDisk()` | Backend próprio com retry e backoff para `EPERM`/`EBUSY`, escrita temp + rename com fallback, sem hard links **(comportamento do OneDrive não verificado)** |
| `.tmp-*` e `.recovery-*` (cópias completas, até 32 arquivos / 64 MiB cada) sincronizando | `saveToDisk()` / `pruneRecoveryFiles()` | Recovery em diretório local, ou contar com o histórico de versões do próprio OneDrive |
| Cópias de conflito do OneDrive (ex.: `MEMORY-<PC>.md`) são ignoradas pelo loader | `pathFor()` só lê o nome canônico | Detectar e avisar no `/…-doctor` ou no onboarding |
| Obsidian (ou plugins como Linter) editando o arquivo durante a escrita | Fingerprint e `ExternalMemoryWriteConflict` já existem (até 2 retries) | Preferir notas append-only ou uma nota por memória para reduzir conflitos |
| Arquivos com ponto inicial não aparecem no Obsidian, mas o OneDrive os sincroniza | comportamento conhecido do Obsidian **(não verificado aqui)** | Idem acima |
| PowerShell aberto pelo lock coordinator no startup | #245 / #247 | Usar um fork com o PR #247, ou simplificar os locks |
| Sem CI Windows; `better-sqlite3` nativo (rebuild via `npm rebuild` com `spawnSync` em caso de ABI divergente) | `sqlite-native.ts`, `ci.yml` | Adicionar CI Windows; avaliar `node:sqlite` embutido (usado por `@pify/memory`) |

#### (b) Remover os limites de tamanho

- **Já é quase o comportamento padrão.** Em `policy-only`, `capEnforced` é falso e add, replace e mutation plan não são barrados (#218).
- **Para eliminar os limites de vez:**
  - remover ou neutralizar `charLimit()`, `capEnforced` e os ramos de limite em `_add()`, `replaceUnlocked()` e `applyMutationPlan()`;
  - remover `memoryFullError()`, `fifoEvictAndAdd()`, o retry de consolidação em `addWithConsolidation()`, `overflowSince` e a grace;
  - remover o `store.setConsolidator(...)` e o `configureProjectStore` em index.ts, e o caminho automático de `triggerConsolidation()`;
  - remover as chaves `memoryCharLimit`, `userCharLimit`, `projectCharLimit`, `memoryOverflowStrategy`, `overflowGraceMs` e `autoConsolidate`;
  - trocar o `usage: NN% — X/Y` em `successResponse()` e `renderBlock()` por contagens simples.
- **Atenção:** "ilimitado" precisa de representação explícita (`null` ou uma flag). `memoryCharLimit: 0` em `legacy-inject` **bloqueia todo add** (`newTotal > 0`), e JSON não aceita `Infinity`.
- **Limites fixos que continuam existindo:**
  - `STANDING_MAX_ENTRIES` e `STANDING_MAX_CHARS` (constantes)
  - limites de busca (20 resultados, 4.000 caracteres de snippet, 50 KiB)
  - 100 KiB por mensagem indexada
  - 50 arquivos por backfill
  - Decidir quais devem virar configuração.

**O que quebra ou degrada sem limites:**

1. **`legacy-inject` fica inviável.** O pacote injeta tudo a cada prompt, o que incha o contexto e o custo. Qualquer recarga ou escrita que mude os blocos (projeto e falhas são "ao vivo") invalida o prefix cache.
   - Caminho: ficar em `policy-only` e usar **retrieval**, ou seja, a tool `memory_search` somada a um *active recall* com orçamento de tokens, como no PR #216 (em `before_agent_start` ou no evento `context`).
2. **A qualidade do recall passa a depender da busca.** Hoje é FTS5 trigram, com stop-words só em inglês e sem semântica (memória em português perde precisão). Com muitos itens, o topo (10 a 20) fica ruidoso.
   - Caminho: qmd ou embeddings (PR #175), filtros por vault, projeto e categoria, e boosting por `last_referenced`.
3. **Crescimento sem freio.** O review escreve entradas "generosas" (#229); o dedupe só pega texto idêntico; a consolidação automática não dispara.
   - É preciso dedupe semântico ou merge periódico, *aging* e arquivamento.
4. **Operações por substring (`old_text`) ficam ambíguas** ("Multiple entries matched") conforme o volume cresce. Faltam IDs estáveis por memória.
5. **Custo O(n) por escrita.** Cada mutação relê o arquivo inteiro, reescreve tudo e cria um snapshot completo de recovery. Arquivos grandes significam mais churn de sync no OneDrive e mais chance de conflito. Uma nota por memória, ou append-only, resolve.
6. **A consolidação por LLM**, se mantida, manda o store inteiro no prompt e estoura contexto com stores grandes. Seria preciso fazê-la por lotes ou por cluster.
7. **O review em background também cresce:** envia o branch inteiro a cada 10 turnos. Isso já é custo hoje; `reviewRecentMessages` ajuda.

#### (c) Tornar tudo configurável e criar um onboarding

**O que existe hoje:**
- Um JSON único, lido uma vez, sem escrita, sem schema e com fallback silencioso.
- Nenhum comando de setup.
- O `/memory-interview` preenche apenas o perfil do usuário via LLM.

**O que construir:**
1. **Schema de config versionado** (TypeBox, que já é dependência). Um loader que **reporte** erros via `ctx.ui.notify` em `session_start` e um writer atômico.
2. **Config de máquina** (paths absolutos variam por PC) fora do OneDrive, por exemplo `~/.pi/agent/<pacote>-config.json`. Opcionalmente um `vault.json` dentro do vault para preferências que valem para todas as máquinas.
3. **Comando `/…-setup`** com `ctx.ui.select`, `input` e `confirm` (ou `ctx.ui.custom` para um formulário). Passos:
   - detectar o OneDrive (variáveis `OneDrive`, `OneDriveConsumer` e `OneDriveCommercial` no Windows **(não verificado)**);
   - detectar vaults (pastas com `.obsidian/` e o registro `%APPDATA%\obsidian\obsidian.json` **(não verificado)**);
   - escolher pasta e regras de roteamento;
   - validar a escrita;
   - pré-visualizar (reaproveitar `/memory-preview-context`);
   - gravar e chamar `ctx.reload()`.
4. **Auto-disparo:** em `session_start`, se não houver config e `ctx.hasUI`, notificar ou oferecer o setup.
5. **Tornar configuráveis:** os prompts de review, flush, correction e consolidation (#229), os limites fixos, os padrões de correção em português e as stop-words em português.
6. **Inspiração no Hermes:** o `get_config_schema()` dos providers alimenta o `hermes memory setup`, um setup *dirigido por schema* (Parte 3.7).

#### Caminhos de reuso (trade-offs)

| Opção | Prós | Contras |
|---|---|---|
| **Fork com refactor** (extrair `MemoryBackend`, backend "vault") | Reaproveita os 732 testes, review, correction, flush, scanner, busca e skills. A MIT permite. | O código é grande (cerca de 1 MB publicado) e acoplado; é preciso acompanhar o upstream, que é ativo |
| **Pacote novo reaproveitando módulos** (`content-scanner`, `fts-query`, `schema`, `session-indexer/parser`, `review-memory-ops`, `pi-child-process`) | Design limpo e Obsidian-first; dá para descartar legacy e migrações | Mais trabalho; perde a integração pronta |
| **Contribuir upstream** (interface de backend e `customInstructions`) | Beneficia os dois lados; o autor responde issues rapidamente | Depende de aceite; o tempo de retorno é incerto |

---

## Parte 3: a origem: memória do Hermes Agent (Nous Research)

Fontes:
- Repo: https://github.com/NousResearch/hermes-agent (MIT, "Copyright (c) 2025 Nous Research"; criado em 2025-07-22; cerca de 248k stars)
- Docs de memória: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Código: https://github.com/NousResearch/hermes-agent/blob/main/tools/memory_tool.py

### 3.1 Memória limitada: MEMORY.md e USER.md

- Arquivos em `~/.hermes/memories/` (`HERMES_HOME/memories`):
  - `MEMORY.md`: notas do agente, **2.200 caracteres** (cerca de 800 tokens)
  - `USER.md`: perfil do usuário, **1.375 caracteres** (cerca de 500 tokens)
- Delimitador `§`.
- **Config** (`cli-config.yaml.example`, seção `memory:`): `memory_enabled`, `user_profile_enabled`, `memory_char_limit: 2200`, `user_char_limit: 1375`, `nudge_interval: 10` ("every N user turns", 0 desliga) e `write_approval` (docs de configuração).
  - Observação: a issue #16831 ("Configurable memory character limit (currently hardcoded at 2,200)") foi fechada como *not_planned* em 2026-06-10, mas o exemplo de config atual expõe as chaves.
- **Racional:**
  - Memória curada e **limitada** mantém o system prompt pequeno e força curadoria.
  - Os limites são medidos em caracteres porque isso independe do modelo (o exemplo de config usa cerca de 2,75 caracteres por token).
  - **Não há auto-compactação.** Ao estourar, a tool devolve erro com as entradas atuais e o agente precisa consolidar no mesmo turno.

### 3.2 A tool `memory`

- **Uma** tool, `memory`, com `target` ∈ {`memory`, `user`}.
- Formato de operação única: `action` ∈ {add, replace, remove}, `content` (ou o alias `new_text`), `old_text` (substring que **localiza** a entrada; `replace` sobrescreve a entrada inteira).
- **Formato em lote:** `operations: [{action, content?, old_text?}]`, aplicado atomicamente, com o limite checado **só no resultado final**. Isso permite remover e adicionar numa única chamada para abrir espaço.
- A descrição orienta a guardar em memória só fatos úteis em **toda** sessão. Aprendizados de tarefa vão para **skills** (`skill_manage`), que só carregam quando são relevantes.
- Scan de injeção, exfiltração e unicode invisível, e rejeição de duplicatas exatas.

### 3.3 Snapshot congelado e prefix cache

- O docstring de `memory_tool.py` e as docs dizem o mesmo: os dois arquivos entram no system prompt como **snapshot congelado no início da sessão**.
- Escritas no meio da sessão vão direto ao disco, mas **não** alteram o prompt até a próxima sessão.
- O motivo declarado é **preservar o prefix cache** do LLM (custo e latência previsíveis em sessões longas).

### 3.4 session_search (SQLite FTS5)

Fonte: https://github.com/NousResearch/hermes-agent/blob/main/tools/session_search_tool.py

- Busca sobre o banco de sessões SQLite (`~/.hermes/state.db`) com FTS5.
- **Sem chamadas a LLM:** devolve mensagens reais.
- Quatro formatos inferidos pelos argumentos: discovery (query, com dedupe por *lineage* de sessões pai e filha), scroll, read e browse.
- Discovery tem limite padrão 3 (máximo 10).

### 3.5 Skills a partir da experiência

Fonte: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills

- O agente cria e atualiza skills com `skill_manage` quando resolve um fluxo não trivial, se recupera de erros ou recebe correções.
- As skills ficam em `~/.hermes/skills/` no padrão agentskills.io (`SKILL.md` com procedimento, armadilhas, verificação e subpastas `references/`, `templates/`, `scripts/`, `examples/`), com *progressive disclosure*.
- `skills.write_approval: true` coloca as escritas em staging para aprovação humana.
- O review em background do Hermes inclui um prompt de skills (`_SKILL_REVIEW_PROMPT`, conforme o PLAN.md do pi-hermes-memory).

### 3.6 Plugin de provider de memória externa

Fontes:
- https://hermes-agent.nousresearch.com/docs/developer-guide/memory-provider-plugin/
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory-providers.md

- ABC `MemoryProvider` em `agent/memory_provider.py`. O plugin fica em `plugins/memory/<nome>/` (`__init__.py`, `plugin.yaml`, `README.md`).
- **Obrigatórios:** `name`, `is_available()` (sem rede), `initialize(session_id, **kw)`, `get_tool_schemas()`, `handle_tool_call()`, `get_config_schema()`, `save_config(values, hermes_home)`.
- **Hooks opcionais:**

| Hook | Função |
|---|---|
| `system_prompt_block()` | informação estática do provider |
| `prefetch(query)` | contexto recuperado antes da chamada à API |
| `queue_prefetch(query)` | pré-aquecimento para o próximo turno |
| `sync_turn(user, assistant, …)` | persistir a conversa; **precisa ser não bloqueante** |
| `on_session_end(messages)` | extração ou flush final |
| `on_pre_compress(messages)` | salvar insights antes do descarte; há um contrato opcional de checkpoint |
| `on_memory_write(action, target, content)` | espelhar escritas no backend |
| `shutdown()` | fechar conexões |

- **Regra:** **só um** provider externo ativo por vez, sempre **ao lado** da memória embutida, nunca no lugar dela.
- Setup via `hermes memory setup / status / off`, ou `memory.provider` no `config.yaml`.
- Providers: Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, Supermemory, Memori. **Nenhum é voltado a Obsidian.**

### 3.7 O que o pi-hermes-memory manteve, mudou ou descartou

| Aspecto | Hermes | pi-hermes-memory (v0.9.9) | Status |
|---|---|---|---|
| Arquivos e delimitador | MEMORY.md e USER.md, `§` | Os mesmos, mais `failures.md`, `STANDING.md` e MEMORY.md de projeto | **Mantido e ampliado** |
| Limites | 2.200 / 1.375 (config) | 5.000 / 5.000 / 5.000 (a v0.1 usava 2.200/1.375); **ignorados em policy-only** | **Mudado** |
| Sem auto-compactação (erro) | sim | Estratégias `reject`, `fifo-evict` e `auto-consolidate` (esta é o padrão; só vale em legacy) | **Mudado** |
| Tool | uma tool `memory` com `action` e `operations` em lote | três tools (`memory_add`, `memory_replace`, `memory_remove`) mais `memory_search`. **O lote não é exposto ao LLM**; só existe internamente (`applyMutationPlan`). | **Mudado** |
| Targets | memory, user | mais `project` e `failure` com 6 categorias | **Ampliado** |
| Injeção | snapshot congelado **sempre** no prompt | padrão `policy-only` (nenhum conteúdo, o modelo busca); o snapshot existe só em `legacy-inject` | **Mudado** (principal diferença de design) |
| Fencing | `build_memory_context_block()` | `<memory-context>` com aviso | **Mantido** |
| Scanner | padrões de ameaça e unicode invisível | os mesmos, mais cerca de 20 padrões de segredo | **Mantido e ampliado** |
| Review em background | thread ou fork do agente com prompts de memória e skill; nudge a cada N turnos do usuário | `completeSimple` direto (JSON de operações) ou `pi -p`; nudge por turnos do agente **ou** tool calls; **não cria skills** | **Mudado** |
| Flush | `flush_memories()` e `flush_min_turns` | `session_before_compact` e `session_shutdown`, com `flushMinTurns=6` | **Mantido** |
| session_search | FTS5 com lineage, scroll e read, sem LLM | FTS5 **trigram** com snippets (legacy) ou anchors sobre JSONL; também indexa ao vivo | **Mudado** |
| Busca na memória | não tem (memória está sempre no prompt) | espelho SQLite `memories` + `memory_fts` e `memory_search` | **Novo** |
| Skills | `skill_manage`, `~/.hermes/skills`, `write_approval` | `skill_manage` com SKILL.md nativo do pi e escopo global ou projeto; sem aprovação | **Mantido e adaptado** |
| Detecção de correção, memória de falhas, aging (created/last), standing instructions, memória por projeto | — | presentes | **Novos** |
| Provider externo (`MemoryProvider`) | presente | planejado (`MemoryOrchestrator`/`ExternalSync`, v0.5) e **não implementado** | **Descartado ou adiado** |
| `write_approval` e toggles `memory_enabled`/`user_profile_enabled` | presentes | não encontrados **(ausência não verificada exaustivamente)** | **Descartado** |

---

## Parte 4: pacotes pi relacionados

Fontes: busca no registry npm pela keyword `pi-package` mais o termo (https://registry.npmjs.org/-/v1/search?text=keywords:pi-package%20<termo>) e a página https://pi.dev/packages. Datas e versões são as do registry em 2026-09-23. A coluna "autor" traz o *publisher* no npm. A licença só aparece quando foi conferida.

### 4.1 Memória e Obsidian (os mais relevantes)

| Pacote | Autor | Versão, data | Descrição (1 linha) | Reuso? |
|---|---|---|---|---|
| [@tenchi4u/pi-obsidian-memory](https://github.com/the-matt-moo/pi-obsidian-memory) | tenchi4u | 0.1.0, 2026-08-26 | Memória no vault (`$OBSIDIAN_PATH/pi/`: MEMORY.md, SCRATCHPAD.md, `daily/`), env `PI_MEMORY_DIR`/`OBSIDIAN_PATH`, **notas para Windows**, busca qmd, snapshot "stable" vs "per-turn" com orçamento de 16K caracteres. MIT. | ⭐ **Forte referência** para configurar o path do vault e para orçamentos de injeção |
| [pi-memory](https://github.com/jayzeng/pi-memory) | jayzeng | 0.4.2, 2026-08-11 | Memória com daily logs, longo prazo e scratchpad, e busca semântica via qmd. MIT. | Referência (qmd) |
| [@pify/memory](https://github.com/pifydev/memory) | hypnguyen1209 | 0.11.1, 2026-09-23 | Markdown puro em duas camadas, **FTS5 via `node:sqlite`** (sem módulo nativo), scan de segredos, injeção estável ao cache. MIT. | ⭐ Ideia para evitar o `better-sqlite3` no Windows |
| [common-memory-core](https://github.com/Mr-remon219/common-memory) | mr_remon | 0.4.3, 2026-09-15 | "User-owned Markdown memory" com manutenção durável, integração pi e MCP. MIT. | Referência |
| [@zosmaai/pi-llm-wiki](https://github.com/zosmaai/pi-llm-wiki) | arjun-zosma | 0.12.2, 2026-09-11 | Wiki LLM auto-mantida (padrão Karpathy), **vault compatível com Obsidian**, qmd, MCP. MIT. | É o vault citado na issue #229 como camada complementar ao hermes |
| [pi-persistent-intelligence](https://github.com/Mont3ll/pi-persistent-intelligence) | mont3ll | 0.16.0, 2026-09-05 | Memória "governada" (L1/L2/L3, patches), session search, integração **opcional** com Obsidian; canônico em JSONL. MIT (npm). | Ideias de governança |
| [pi-vault-mind](https://github.com/kylebrodeur/pi-vault-mind) | kylebrodeur | 0.16.36, 2026-08-30 | Extensão passiva de vault Obsidian: marcadores `@agent`, subagents, LanceDB (vetor, FTS e grafo). MIT. | Pesado; ideias de marcadores |
| [@fancyrobot/agent-vault](https://github.com/TheFancyRobot/agent-vault) | sincspecv | 0.5.3, 2026-08-03 | Memória de projeto num vault compatível com Obsidian, com MCP. MIT; peers ainda em `@mariozechner/*`. | Referência (possivelmente desatualizado) |
| [knapsack-pi](https://github.com/acidsugarx/knapsack) | acidsugarx | 0.3.2, 2026-07-22 | Redução de tokens e memória persistente em Obsidian | Não inspecionado |
| [pi-obsidian-capture](https://github.com/Wormh0-le/pi-obsidian-capture) | wormh01e | 0.1.2, 2026-09-05 | Captura conversas finalizadas para o Obsidian | Ideia de captura |
| [@bacnh85/pi-obsidian](https://github.com/bacnh85/pi-extensions) | bacnh85 | 0.8.18, 2026-09-23 | Tools de vault via **Obsidian CLI**. MIT. | Acesso via CLI em vez de fs |
| [@sfroment/pi-obsidian](https://github.com/sfroment/pi-obsidian) | sfroment | 1.0.14, 2026-09-16 | Tool tipada sobre o Obsidian CLI. **GPL-3.0** | ⚠️ Licença incompatível para incorporar em código MIT |
| [pi-obsidian-cli](https://github.com/frNNcs/pi-obsidian-cli), [@capyup/pi-obsidian](https://github.com/capyup/pi-obsidian), [pi-obsidian-rest](https://github.com/mooreceipts/pi-obsidian-rest), [pi-obsidian-vault](https://github.com/itscool2b/pi-obsidian-vault) | vários | 2026 | Wrappers de CLI e Local REST API, e acesso com aprovação humana | Alternativas de acesso |
| [@henryqw/pi-memory](https://github.com/HenryQW/pi-harness), [@samfp/pi-memory](https://github.com/samfoy/pi-memory), [pi-memory-md](https://github.com/VandeeFeng/pi-memory-md), [open-zk-kb](https://github.com/mrosnerr/open-zk-kb), [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory), [@mem0/pi-agent-plugin](https://github.com/mem0ai/mem0), [pi-honcho](https://github.com/giuseppecrj/pi-honcho), [@luxusai/pi-hindsight](https://github.com/luxus/pi-hindsight) | vários | 2026 | Outras memórias: Markdown com caps, Letta-like, Zettelkasten, observacional, Mem0, Honcho, Hindsight | Comparação |
| Forks do hermes-memory: [@schovest/pi-hermes-memory](https://github.com/schovest/pi-package-mono), [@efrembaraldo/gsd-pi-hermes-memory](https://github.com/efrembaraldo/gsd-pi-hermes-memory) (MIT), forks no GitHub (Arteiimis, podledges, Coder-Sang, Noir-Lime) e [jamiefutch/pi-hermes-memory-cleanup](https://github.com/jamiefutch/pi-hermes-memory-cleanup) | vários | 2026 | Forks e utilitários | Precedentes de fork (conteúdo não inspecionado) |

### 4.2 Spec-driven development

| Pacote | Autor | Descrição | Nota |
|---|---|---|---|
| [pi-sdd-extension](https://github.com/yswtrue/pi-sdd-extension) | GitHub Actions (yswtrue) | Workflow SDD para o pi. MIT. | |
| [@ifi/pi-spec](https://github.com/ifiokjr/oh-pi) | ifiokjr | spec-kit nativo com `/spec` | |
| [pi-spec-builder](https://github.com/lleontor705/pi-spec-builder) | luisito15 | SDD e planejamento de arquitetura | |
| [@mjasnikovs/pi-task](https://github.com/mjasnikovs/pi-task) | mjasnikovs | Planejamento determinístico e orquestração de specs | Bem ativo (0.42.x) |
| [forte-spec](https://github.com/fortezhuo/forte-spec) | forte.zhuo | Forte-Spec + OpenSpec + Superpowers | |
| [@the-agency/pi-spec-kit](https://github.com/JoshMock/the-agency), [@cleepi/sdd](https://github.com/honzanemecek/cleepi), [@capyup/pi-specs](https://github.com/capyup/pi-specs), [@abianbiya/speclet e specflow](https://github.com/abianbiya/skills), [pi-gsd](https://github.com/fulgidus/pi-gsd), [pi-zense](https://github.com/zurge-co/pi-zense) | vários | Variantes de SDD (Spec Kit, GSD, specs de arquivo único) | |

### 4.3 Plan mode e to-do

| Pacote | Autor | Descrição | Nota |
|---|---|---|---|
| `examples/extensions/plan-mode` (oficial) | earendil-works | Plan mode estilo Claude Code, `/plan`, read-only | ⭐ Ponto de partida oficial |
| [@narumitw/pi-plan-mode](https://github.com/narumiruna/pi-extensions) | narumitw | `/plan` read-only estilo Codex | |
| [@hank-warren/pi-plan-mode](https://github.com/hank-warren/pi-extensions) | hank-warren | Plano durável em arquivo que sobrevive à compaction | Plano persistido (combina com vault) |
| [@plannotator/pi-extension](https://github.com/backnotprop/plannotator) | backnotprop | Revisão interativa de plano com anotações | |
| [@alexeiled/pi-plan-exec](https://github.com/alexei-led/pi-plan-exec) | alexeiled | Plano em Markdown executado de forma isolada e retomável | |
| `examples/extensions/todo.ts` (oficial) | earendil-works | Tool de todo e `/todos` com estado persistido | ⭐ Referência de estado em `details` |
| [@juicesharp/rpiv-todo](https://github.com/juicesharp/rpiv-mono) | juicesharp | Todo em overlay ao vivo (cerca de 159K/mês na pi.dev) | |
| [@getpipher/armory-todo](https://github.com/getpipher/armory-todo), [pi-todo](https://github.com/mrg2400xx/pi-todo) | rz1989 / mrg2400xx | TODO global entre sessões; tracker persistente por projeto | |

### 4.4 Subagents

| Pacote | Autor | Descrição | Nota |
|---|---|---|---|
| `examples/extensions/subagent` (oficial) | earendil-works | Delegação com janelas de contexto isoladas | ⭐ Referência |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | nicopreme | Delegação e workflows multiagente (cerca de 455K/mês). MIT. | Mais popular |
| [@narumitw/pi-subagents](https://github.com/narumiruna/pi-extensions), [@agwab/pi-subagent](https://github.com/AgwaB/pi-subagent), [@pi-archimedes/subagent](https://github.com/danielcherubini/pi-archimedes), [@melihmucuk/pi-crew](https://www.npmjs.com/package/@melihmucuk/pi-crew) | vários | Jobs assíncronos, runtime mínimo, streaming TUI e custo | |

### 4.5 Questionários e entrevistas (úteis para o onboarding)

| Pacote | Autor | Descrição | Nota |
|---|---|---|---|
| `examples/extensions/questionnaire.ts` e `question.ts` (oficiais) | earendil-works | Tool `questionnaire` (abas, várias perguntas) e `question` (select mais texto livre), com `ctx.ui.custom` | ⭐ Base de UI para o wizard |
| [@juicesharp/rpiv-ask-user-question](https://github.com/juicesharp/rpiv-mono) | juicesharp | Questionário estruturado que o modelo aplica (cerca de 204K/mês). MIT. | Reuso direto como dependência |
| [pi-interview](https://github.com/nicobailon/pi-interview-tool) | nicopreme | Formulário de entrevista interativo. MIT. | |
| [@firstpick/pi-extension-grill-me](https://github.com/Firstp1ck/pi-coding-agent-forge) | firstpick | Entrevista de design guiada por questionário, com ferramentas de persistência | Entrevista persistida |
| [@dreki-gg/pi-questionnaire](https://github.com/jalbarrang/pi-questionnaire), [@dohmboy64bit/pi-qwizard](https://github.com/DohmBoy64Bit/pi-qwizard), [pi-grill-wizard](https://github.com/erazemkos/pi-grill-wizard), [pi-ask-popup](https://github.com/derangga/pi-extensions) | vários | Wizards de várias etapas com validação | |

---

## 5. Itens não verificados e ressalvas

- **Números de linha** são aproximados (o extrator desalinha a numeração). As âncoras confiáveis são os nomes de funções e constantes.
- **Downloads da pi.dev** (27K/mês, 5.497/semana) diferem da API do npm (21.582 / 3.817). Metodologia desconhecida.
- **Data da renomeação** do pi para `@earendil-works` (maio/2026) vem da Wikipedia e não foi confirmada em fonte primária.
- **Comportamento do OneDrive** com hard links, placeholders "Files On-Demand" e locks `EPERM`/`EBUSY` durante upload: são riscos a testar empiricamente, não foram verificados.
- **Obsidian:** que ignora arquivos com ponto inicial, e o caminho `%APPDATA%\obsidian\obsidian.json` como registro de vaults, são conhecimento geral não confirmado nesta pesquisa. O mesmo vale para as variáveis `OneDrive`, `OneDriveConsumer` e `OneDriveCommercial`.
- **Bug `split('/')` no session-indexer:** inferido da leitura, não reproduzido.
- **"Frozen snapshot" parcialmente mutável em `legacy-inject`:** inferido do código, não medido.
- **READMEs** de @tenchi4u/pi-obsidian-memory e pi-persistent-intelligence foram lidos só em resumo. A licença do segundo no README não foi confirmada (o npm diz MIT). Os demais pacotes da Parte 4 não foram inspecionados além da metadata.
- **Doc do Hermes:** diz que os limites são configuráveis e a issue #16831 foi fechada como *not_planned*. O exemplo de config atual tem as chaves, mas o código que as lê não foi conferido.

## 6. Fontes principais

**pi-hermes-memory**
- https://github.com/chandra447/pi-hermes-memory. Arquivos lidos via `raw.githubusercontent.com/chandra447/pi-hermes-memory/main/…`: `package.json`, `src/index.ts`, `src/config.ts`, `src/constants.ts`, `src/types.ts`, `src/paths.ts`, `src/project.ts`, `src/prompt-context.ts`, `src/memory-initialization.ts`, `src/store/*`, `src/tools/*`, `src/handlers/*`, `README.md`, `CHANGELOG.md`, `PLAN.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/mermaid/*`, `tests/run-all.sh`, `.github/workflows/ci.yml` e `LICENSE`
- Árvore de arquivos: https://api.github.com/repos/chandra447/pi-hermes-memory/git/trees/main?recursive=1
- Commits: https://api.github.com/repos/chandra447/pi-hermes-memory/commits
- Issues e PRs: #175, #216, #229, #245, #246, #247, #211, #238, #218 (via CHANGELOG), #121
- npm e downloads: https://registry.npmjs.org/pi-hermes-memory · https://api.npmjs.org/downloads/point/last-month/pi-hermes-memory · https://pi.dev/packages/pi-hermes-memory

**pi**
- https://pi.dev · https://pi.dev/packages
- https://github.com/earendil-works/pi
- Docs: `packages/coding-agent/docs/{extensions,packages,settings,configuration,skills,sessions,windows}.md`
- Código: `src/core/extensions/types.ts`, `src/core/system-prompt.ts`, `src/core/package-manager.ts`
- Exemplos: `examples/extensions/{hello,prompt-customizer,question,questionnaire,README}`
- https://registry.npmjs.org/@earendil-works/pi-coding-agent · https://api.github.com/repos/earendil-works/pi/releases

**Hermes Agent**
- https://github.com/NousResearch/hermes-agent
- Código: `tools/memory_tool.py`, `tools/session_search_tool.py`, `cli-config.yaml.example`
- Docs: `website/docs/user-guide/features/memory.md`, `…/memory-providers.md`, `…/developer-guide/memory-provider-plugin.md`
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills · https://hermes-agent.nousresearch.com/docs/user-guide/configuration
- Issue #16831

**Registry npm (Parte 4)**
- `https://registry.npmjs.org/-/v1/search?text=keywords:pi-package%20{memory,obsidian,spec,plan,subagent,todo,questionnaire%20interview}`
- `https://registry.npmjs.org/<pacote>/latest` para as licenças conferidas
