# Revisão de código — pi-obsidian-memory (v2)

## Revisão adversarial das mudanças pendentes — 2026-10-12

Esta rodada examinou o diff e os arquivos novos de sincronização, seus contratos de vault/SQLite e a aderência às
camadas. O texto posterior registra revisões anteriores; suas contagens e seus achados não descrevem todos o estado
atual. As mudanças que já estavam no working tree foram preservadas, sem commit ou implementação de novos marcos.

### Achados corrigidos

1. **P1 — Falha de manutenção ficava esquecida após publicar o catálogo.** O usecase escolhia pastas pelos deltas
   do catálogo ou pela ausência de `index.md`. Se o índice existente estivesse read-only, a publicação SQLite
   concluía, a manutenção falhava e a próxima sincronização não tentava novamente. Um teste real tornou o índice
   read-only, alterou `dontForget`, confirmou o aviso, restaurou a escrita e reproduziu o índice permanentemente
   antigo. Agora cada pasta física completamente enumerada é reconferida em toda sincronização.
2. **P2 — Remover uma pasta vazia deixava um link obsoleto no pai.** Pastas não são linhas de notas no catálogo;
   sua remoção não produzia `touchedFolders`. O teste criou a pasta, sincronizou, removeu-a e confirmou o link
   incorreto. A reconferência das pastas sobreviventes corrige também esse caso sem exigir mudanças no SQLite.
3. **P2 — Duas convenções incompatíveis para localizar o mesmo índice.** O novo `indexPathForVault` usava SHA-256
   completo do caminho literal, enquanto `indexFileFor` já normalizava o caminho e usava 16 caracteres. Havia duas
   APIs públicas para a mesma responsabilidade. O sincronizador usa agora `indexFileFor`, movido de `open.ts` para
   `location.ts`, com os testes comportamentais movidos para o caminho espelhado. Um cache experimental criado pela
   função removida não é migrado ou apagado; o índice no caminho estabelecido é reconstruível a partir das notas.

A reconferência de pastas aumenta as leituras. Para evitar substituições desnecessárias, o serviço compara os bytes
do índice com o conteúdo renderizado e preserva o arquivo idêntico. Um terceiro teste falhou antes dessa mudança,
mostrando a troca de inode/mtime, e passou depois. A seleção antiga de pastas e aliases foi removida do usecase;
o serviço continua responsável pela listagem, renderização e escrita no vault. Não foram introduzidos comentários,
mocks de filesystem ou tipos abertos.

### Validação e limites

- TDD: os dois cenários de inconsistência e a preservação do índice foram executados em vermelho antes das correções
  e passaram depois. Os testes usam diretórios temporários reais.
- Suíte completa Windows: **150 arquivos, 1.122 testes aprovados e 1 ignorado**, com quatro workers.
- Smoke test isolado do pi: **1 aprovado**. Biome, TypeScript e `git diff --check`: sem erros.
- Os executáveis locais foram chamados diretamente porque `npm` não estava no PATH. A execução inicial no sandbox
  falhou por `EPERM` na resolução do diretório temporário e na criação de symlinks. A suíte final foi executada com
  acesso normal do Windows, permitindo os testes reais de links e ACLs; isso não exigiu mudanças nas permissões dos
  vaults do usuário. Houve timeout do teste de ACL sob a concorrência inicial; ele passou isoladamente e na execução
  completa limitada a quatro workers.
- Permanecem os limites documentados: reutilização por tamanho/mtime pode manter conteúdo antigo; verificações de
  links e hashes não tornam update/remoção atômicos; o lease protege a sessão, não coordena processos independentes.
  O custo da reconferência de todos os índices de pasta não foi medido em vaults grandes.
- A inspeção de imports não encontrou novo salto entre camadas ou dependência entre recursos distintos de services.
  As regras Biome não provam sozinhas toda a política de recursos: imports laterais dentro de services continuam
  exigindo revisão. Não foi declarada conformidade exaustiva de todos os módulos ou conclusão de marcos do produto.

## Histórico das revisões anteriores

Revisão de todo o código em `src/`, `tests/`, `biome/` e dos docs, feita com foco em qualidade: arquitetura,
desenho dos módulos, tipos, nomes, duplicação, tratamento de erros, testes e coerência com os docs e o `AGENTS.md`.

Estado verificado antes da revisão: árvore git limpa, `npm run lint`, `npm run typecheck` e `npm test`
(380 testes) passando. Ou seja: **nenhum dos problemas abaixo é pego pelas checagens automáticas**, e é justamente
por isso que estão listados.

**Contrarrevisão:** as afirmações e propostas abaixo foram conferidas novamente no commit `9408837`.
Veja [Contrarrevisão das afirmações](#contrarrevisão-das-afirmações): há correções importantes aos itens originais,
limites das soluções sugeridas e cinco novos achados (30–34). Os exemplos originais não devem ser tratados como
implementações aprovadas.

Cada item segue o mesmo formato:

- **Onde**: arquivo e linha.
- **O que está errado**: o problema.
- **Por que está errado**: a consequência real ou a regra violada.
- **Versão correta**: como deveria ficar.

Severidade: 🔴 bug (comportamento errado hoje) · 🟠 arquitetura/desenho (vai custar caro ao crescer) · 🟡 qualidade
local (duplicação, nomes, tipos) · ⚪ menor.

---

## Sumário

| # | Severidade | Tema |
|---|---|---|
| 1 | 🔴 | `listFolder` e `refreshIndexes` lançam `ENOENT` numa pasta que não existe |
| 2 | 🔴 | `memory_add` diz "não salvo" quando a nota **foi** salva e só o índice falhou |
| 3 | 🔴 | `refreshIndexes` perde o motivo da falha e os chamadores inventam `not-writable` |
| 4 | 🔴 | Criar nota não é exclusivo: `rename` pode sobrescrever a nota do usuário |
| 5 | 🔴 | Notas e pastas somem do `index.md` em silêncio |
| 6 | 🔴 | Arquivar/suceder pode deixar estado parcial numa recusa "normal" |
| 7 | 🟠 | `services/memory` não é um recurso: mistura domínio e usecase |
| 8 | 🟠 | `services/config` depende de `services/vault` para ler um arquivo |
| 9 | 🟠 | O barrel de `services/vault` exporta as primitivas internas |
| 10 | 🟠 | Services escrevem textos de UI com comandos do pi (que nem existem) |
| 11 | 🟠 | O índice de busca expõe o `DatabaseSync` cru |
| 12 | 🟠 | Dependências escondidas: `newNote` lê relógio e gera id por dentro |
| 13 | 🟠 | Assinaturas inconsistentes: `vault`, `vaultName`, `limits` soltos em todo lugar |
| 14 | 🟠 | `domain/note` mistura regras de nota com layout do vault |
| 15 | 🟡 | Tipos catch-all: `object` em três lugares |
| 16 | 🟡 | Um único `VaultFailureReason` para todas as operações |
| 17 | 🟡 | Discriminação por `in` em vez de discriminante; `respondTo` não é exaustivo |
| 18 | 🟡 | A lista de campos do frontmatter existe em 6 lugares |
| 19 | 🟡 | Validação e busca repetidas no fluxo de criação |
| 20 | 🟡 | `files.ts`: o mesmo try/catch 5 vezes e um nome enganoso |
| 21 | 🟡 | Normalização de caminho duplicada entre domain e search-index |
| 22 | 🟡 | Duplicações menores em `domain/note` e `services/vault` |
| 23 | 🟡 | Índice FTS5: apagar por `id UNINDEXED` varre a tabela inteira |
| 24 | ⚪ | Objetos `Intl` e `prepare()` recriados a cada chamada |
| 25 | 🟡 | Estratégia de erro inconsistente (exceção vs. resultado) |
| 26 | ⚪ | Mensagens cruas do TypeBox e um filtro "mágico" |
| 27 | 🟡 | Testes: espelhamento quebrado, testes de constantes, helpers duplicados |
| 28 | 🟡 | Testes ausentes para os caminhos de falha que geram os bugs 1–6 |
| 29 | ⚪ | Docs e `package.json` divergindo do código |

---

## 🔴 Bugs

### 1. `listFolder` e `refreshIndexes` lançam `ENOENT` numa pasta que não existe

- **Onde**: `src/services/vault/list.ts:16`, `src/services/vault/refresh.ts:27-32`.
- **O que está errado**: `resolveFolder` **aceita** uma pasta que não existe (em `checkLinksStayInside`, quando o
  `lstat` falha, devolve `{ succeeded: true }`). Em seguida `listFolder` chama `readdir` direto, sem tratar a
  ausência. Reproduzido nesta revisão:

  ```text
  listFolder(vault, "missing", limits)          → Error: ENOENT: scandir '...\missing'
  refreshIndexes(vault, "missing/deep", ...)    → Error: ENOENT: scandir '...\missing\deep'
  ```

- **Por que está errado**: todo o projeto modela falhas esperadas como resultado (`{ succeeded: false, reason }`),
  e uma pasta inexistente é uma falha esperada (o `memory_get` do marco 2 vai receber caminhos digitados pelo LLM).
  Hoje isso derruba a ferramenta com uma exceção crua. O próprio código já sabe tratar o caso em outro lugar
  (`entriesOf` em `files.ts` devolve `[]` para `ENOENT`), então o comportamento é inconsistente.
- **Versão correta**: ler o diretório através de uma primitiva que devolve resultado, e recusar com motivo claro.

  ```ts
  // services/vault/files.ts
  export async function directoryEntriesOf(path: string): Promise<DirectoryEntriesResult> {
    try {
      return { succeeded: true, output: await readdir(path, { withFileTypes: true }) }
    } catch (error) {
      if (error instanceof Error && isMissingFile(error)) {
        return { succeeded: false }
      }

      throw error
    }
  }

  // services/vault/list.ts
  const entries = await directoryEntriesOf(directory.output)
  if (!entries.succeeded) {
    return { succeeded: false, reason: "not-found", problems: [`${folder} does not exist`] }
  }
  ```

  E um teste em `tests/services/vault/list.test.ts` e `refresh.test.ts` para a pasta ausente.

### 2. `memory_add` diz "não salvo" quando a nota foi salva e só o índice falhou

- **Onde**: `src/usecases/add-memory/add-memory.ts:37-40`, `src/pi/memory-add/respond.ts:23`.
- **O que está errado**: depois de `createMemoryNote` gravar a nota, se `refreshIndexes` falhar o usecase devolve
  `{ succeeded: false, reason: "not-writable" }`. O `respondTo` transforma isso em `isError: true` com o texto do
  problema do índice.
- **Por que está errado**: a nota **está no disco**. O LLM recebe um erro, conclui que não salvou e tenta de novo —
  e aí recebe "already exists". O resultado mente sobre o estado do sistema. O mesmo acontece em
  `relocate.ts:106-117`: os arquivos já foram movidos e o resultado diz falha.
- **Versão correta**: separar "a operação principal" de "a manutenção do índice". A nota salva é sucesso; o problema
  do índice vai junto, como aviso.

  ```ts
  // usecases/add-memory/types.ts
  export interface AddedMemory {
    vaultName: string
    folder: string
    notePath: string
    stored: StoredNote
    indexProblems: string[]
  }

  // usecases/add-memory/add-memory.ts
  const refreshed = await refreshIndexes(path, request.folder, name, limits)
  const indexProblems = problemsOf(refreshed)
  const notePath = displayNotePath(request.folder, created.output.note.statement)

  return { succeeded: true, output: { vaultName: name, folder: request.folder, notePath, stored: created.output, indexProblems } }
  ```

  E o `respondTo` diz "Saved in …" com `isError: false`, acrescentando "The folder index could not be refreshed: …"
  quando `indexProblems` não estiver vazio.

### 3. `refreshIndexes` perde o motivo da falha e os chamadores inventam `not-writable`

- **Onde**: `src/services/vault/types.ts:72` (`RefreshResult = Done | Failed`), `refresh.ts:24,45,50,57`,
  `add-memory.ts:39`, `relocate.ts:112`.
- **O que está errado**: `refreshIndexes` recebe um `VaultRefusal` (com `reason`) de `resolveFolder`/`resolveFile`/
  `listFolder` e o reduz a `{ succeeded: false, problems }`. Quem chama precisa de um `reason` e coloca
  `"not-writable"` à mão — mesmo quando a causa foi `outside-vault`, `vault-missing` ou `invalid`.
- **Por que está errado**: o tipo de retorno joga fora informação que existia, e o chamador preenche com um valor
  falso. Um `index.md` que é link para fora do vault vira "not-writable". Qualquer lógica futura que dependa do
  motivo (mensagem ao usuário, `/memory-doctor`) vai errar.
- **Versão correta**: propagar o `VaultRefusal` inteiro.

  ```ts
  export type RefreshResult = Done | VaultRefusal

  const checked = await resolveFolder(vault, folder)
  if (!checked.succeeded) {
    return checked
  }
  ```

  Para o erro de escrita, `refuseNotWritable` já existe e devolve o motivo certo.

### 4. Criar nota não é exclusivo: `rename` pode sobrescrever a nota do usuário

- **Onde**: `src/services/vault/create.ts:39-48`, `src/services/vault/files.ts:75-94`.
- **O que está errado**: `createNote` primeiro procura um arquivo com o mesmo nome (`findFileIgnoringCase`) e só
  depois grava com `writeAtomically`, que faz `rename(temp, path)`. No Windows, `rename` **substitui** o destino se
  ele existir.
- **Por que está errado**: se o usuário (Obsidian) ou o OneDrive criar a nota entre a checagem e o `rename`, a nota
  dele é sobrescrita sem aviso. Isso quebra a promessa central do `vault-format.md` ("never overwrites the user's
  edit", "a new note is refused when a note with the same name already exists"). O doc só admite a janela de
  checagem-uso para **links**, não para existência. O mesmo vale para `updateNote` (hash conferido, depois
  `rename`) — essa janela é inerente, mas precisa estar documentada como limite.
- **Versão correta**: criação exclusiva e atômica. Gravar o temporário e publicar com `link()` (hard link), que
  falha com `EEXIST` se o destino existir — em NTFS isso também vale para outro "case" do mesmo nome.

  ```ts
  export async function publishExclusively(path: string, text: string): Promise<PublishResult> {
    const temporary = temporaryPathFor(path)
    await writeFile(temporary, text)

    try {
      await link(temporary, path)
      return { succeeded: true }
    } catch (error) {
      if (error instanceof Error && hasCode(error, "EEXIST")) {
        return { succeeded: false, reason: "exists" }
      }

      throw error
    } finally {
      await rm(temporary, { force: true })
    }
  }
  ```

  Se o sistema de arquivos não suportar hard link, a alternativa é `writeFile(path, text, { flag: "wx" })`
  (exclusiva, mas não atômica quanto a conteúdo parcial). Para o `update`, registrar a janela restante em
  `vault-format.md`, seção Writing, junto do limite dos links.

### 5. Notas e pastas somem do `index.md` em silêncio

- **Onde**: `src/services/vault/list.ts:31-51`.
- **O que está errado**:
  1. `addToListing` só guarda o resultado quando o motivo é `invalid` ou `needs-fixing`. Uma nota que é um link para
     fora do vault (`outside-vault`) ou que sumiu entre o `readdir` e a leitura (`not-found`) é descartada.
  2. `isSubject` usa `entry.isDirectory()`. Num `Dirent`, uma junction ou symlink é `isSymbolicLink()`, nunca
     `isDirectory()`. Uma pasta-link **dentro** do vault — que `resolve.ts` aceita explicitamente — nunca aparece
     como assunto.
- **Por que está errado**: `vault-format.md` diz que notas inválidas vão para "Needs fixing" "so they never vanish
  from the map", e que links dentro do vault são seguidos. O índice é o mapa que o LLM usa para descer a árvore; o
  que não está nele não existe para o LLM.
- **Versão correta**: toda falha de leitura vira linha em "Needs fixing" com seu problema; links de pasta são
  resolvidos com `resolveFolder` antes de decidir se são assunto.

  ```ts
  function addToListing(listing: FolderListing, statement: string, read: ReadNoteResult): void {
    if (read.succeeded) {
      listing.notes.push(read.output.note)
      return
    }

    listing.invalid.push({ statement, problems: read.problems })
  }
  ```

### 6. Arquivar/suceder pode deixar estado parcial numa recusa "normal"

- **Onde**: `src/services/vault/relocate.ts:10-29`, `src/services/vault/create.ts:36-37`.
- **O que está errado**: `relocateNote` checa tudo e depois grava as notas em sequência. Se a segunda gravação
  falhar com `not-writable` (pasta somente leitura, arquivo travado pelo OneDrive), a primeira já foi gravada e não é
  desfeita. Além disso `mkdir` em `createNote` não é tratado: um `EPERM` vira exceção, não recusa.
- **Por que está errado**: `vault-format.md` afirma "Everything is checked before anything is written, so the usual
  refusals change nothing" — e o mesmo doc lista "cannot be written (read-only, locked)" como recusa usual. O código
  contradiz o doc. Não perde dados (o original só é apagado no fim), mas deixa a nota duplicada sem que o usuário
  saiba.
- **Versão correta**: ou desfazer o que foi escrito quando um passo seguinte falha (remover as cópias criadas nesta
  operação, que o sistema acabou de gravar e conhece pelo hash), ou corrigir o doc para dizer exatamente o que pode
  sobrar. A primeira opção é a que cumpre a promessa. E `mkdir` passa por uma primitiva que traduz
  `EPERM/EACCES/EBUSY` em `not-writable`, como `writeAtomically` já faz.

---

## 🟠 Arquitetura e desenho

### 7. `services/memory` não é um recurso: mistura domínio e usecase

- **Onde**: `src/services/memory/` inteiro.
- **O que está errado**: o `AGENTS.md` define services como "one resource each (vault, index, config, LLM, clock)".
  `memory` não é recurso nenhum:
  - `target.ts` (`targetVault`) é regra pura sobre a config, sem I/O → é **domínio**;
  - `schemas.ts` (`MemoryScopeSchema`, `MemoryDraftSchema`) define o formato de uma memória → é **domínio**;
  - `draft.ts` (`newNote`) **combina dois services** (clock e id) → pela regra, combinar services é papel do
    **usecase**.
- **Por que está errado**: a escada de camadas existe para que cada camada tenha um papel só. Um "service" que é
  metade regra pura e metade orquestração esconde onde cada coisa mora e abre a porta para services chamarem
  services (ver item 8).
- **Versão correta**:
  - `domain/config/target.ts` → `targetVault(config, scope, workingFolder)` (puro, testado sem disco);
  - `domain/memory/schemas.ts` → `MemoryScopeSchema`, `MemoryDraftSchema`;
  - `domain/note/new.ts` → `newNote(draft, id, day)` (puro);
  - o usecase chama `newNote(request.draft, newNoteId(), today())`.

### 8. `services/config` depende de `services/vault` para ler um arquivo

- **Onde**: `src/services/config/read.ts:2` (`import { readRawFile } from "#/services/vault"`).
- **O que está errado**: o serviço de config usa uma primitiva de arquivo que mora dentro do serviço de vault.
- **Por que está errado**: o arquivo de config não tem nada a ver com vault. Um serviço passa a depender de outro
  por acidente de onde a função foi colocada; qualquer mudança em `vault/files.ts` afeta a leitura de config. É
  também o que obriga o barrel do vault a exportar `readRawFile` (item 9).
- **Versão correta**: as primitivas genéricas de sistema de arquivos (`readRawFile`, `writeAtomically`,
  `removeFile`, `realPathOf`, `hashOf`…) viram o recurso `services/file-system/`, e tanto `vault` quanto `config`
  usam esse recurso. O vault passa a falar só em notas.

### 9. O barrel de `services/vault` exporta as primitivas internas

- **Onde**: `src/services/vault/index.ts`.
- **O que está errado**: o barrel reexporta todos os arquivos, inclusive `files.ts` (`writeAtomically`,
  `removeFile`, `readRawFile`), `refusals.ts`, `relocate.ts`, `paths.ts`, `constants.ts`, e `createNote` (a versão
  que **não** aplica a regra de pasta de memória).
- **Por que está errado**: o barrel é o contrato público do serviço. Exportando tudo, um usecase pode chamar
  `createNote` direto e gravar em `archive/` ou numa pasta oculta, ou usar `writeAtomically` e pular a checagem de
  links. As regras que o serviço garante deixam de ser garantidas.
- **Versão correta**: o barrel exporta só as operações públicas (`createMemoryNote`, `readNote`, `findNote`,
  `updateNote`, `archiveStoredNote`, `succeedStoredNote`, `listFolder`, `refreshIndexes`, `displayNotePath`) e os
  tipos delas. O resto é importado só entre arquivos da própria pasta. Os testes que hoje usam `createNote` para
  montar cenários passam a usar um helper de `tests/helpers` que grava o arquivo com `renderNote`.

### 10. Services escrevem textos de UI com comandos do pi (que nem existem)

- **Onde**: `src/services/config/constants.ts:1` (`"run /memory-setup"`), `src/services/memory/target.ts:12`
  (`"run /memory-init"`), `src/pi/memory-add/constants.ts:11-14`.
- **O que está errado**: a camada de services monta frases para o usuário/LLM citando comandos slash do pi. E esses
  comandos (`/memory-setup`, `/memory-init`) não estão registrados; `SAME_POINT_GUIDANCE` manda "changing it", mas
  nenhuma ferramenta altera nota.
- **Por que está errado**: comandos são da camada pi; o service fica acoplado a nomes de UI. E o LLM é instruído a
  rodar coisas que não existem, o que gera alucinação de chamadas (o `ROADMAP` já reconhece isso no marco 0).
- **Versão correta**: o service devolve só o motivo e os dados (`{ reason: "no-project", workingFolder }`,
  `{ reason: "not-configured", configPath }`); o `pi/memory-add/respond.ts` monta o texto, citando somente o que está
  registrado. Um teste lista os nomes de ferramentas/comandos registrados e prova que nenhum texto cita outro.

### 11. O índice de busca expõe o `DatabaseSync` cru

- **Onde**: `src/services/search-index/types.ts:8` (`export type SearchIndex = DatabaseSync`).
- **O que está errado**: o tipo do serviço é o handle do SQLite. Quem recebe um `SearchIndex` pode rodar qualquer
  SQL.
- **Por que está errado**: "services speak in domain terms". O resto do sistema fica livre para depender do esquema
  das tabelas; trocar o armazenamento (ou adicionar embeddings no marco 5) quebra chamadores. Também impede guardar
  os statements preparados (item 24).
- **Versão correta**: um tipo próprio, opaco para quem está fora do serviço.

  ```ts
  export interface SearchIndex {
    database: DatabaseSync
    statements: IndexStatements
  }
  ```

  Com `openIndex` preparando os statements uma vez e `putNote`/`removeNote`/`searchText`/`closeIndex` como a única
  forma de usá-lo.

### 12. Dependências escondidas: `newNote` lê relógio e gera id por dentro

- **Onde**: `src/services/memory/draft.ts:6-8` vs. `src/services/vault/archive.ts` e `succeed.ts`.
- **O que está errado**: `newNote` chama `today()` e `newNoteId()` internamente, enquanto `archiveStoredNote` e
  `succeedStoredNote` recebem `today` por parâmetro.
- **Por que está errado**: duas convenções para o mesmo tipo de dependência. A função parece pura e não é; o teste
  precisa de `vi.useFakeTimers` para algo que poderia ser um parâmetro.
- **Versão correta**: como no item 7 — `newNote(draft, id, day)` pura, e o usecase é quem lê o relógio e gera o id.

### 13. Assinaturas inconsistentes: `vault`, `vaultName`, `limits` soltos em todo lugar

- **Onde**: todo `src/services/vault/` (ex.: `archiveStoredNote(vault, vaultName, request, limits)`,
  `createNote(vault, folder, note, limits)`, `refreshIndexes(vault, folder, vaultName, limits)` — repare na ordem
  diferente — e `relocateNote({ vault, vaultName, ... }, limits)`).
- **O que está errado**: os mesmos três dados viajam juntos por todas as funções, ora soltos, ora dentro de um
  request, em ordens diferentes. E já existe um tipo para isso que não é usado: `VaultTarget { path, name }` em
  `services/memory/types.ts`.
- **Por que está errado**: parâmetros posicionais do mesmo tipo (`string, string, string`) em ordens diferentes são
  convite a trocar `folder` por `vaultName` sem o typecheck perceber.
- **Versão correta**: um contexto único.

  ```ts
  export interface VaultContext {
    path: string
    name: string
    limits: NoteLimits
  }

  export async function createMemoryNote(vault: VaultContext, folder: string, note: Note): Promise<VaultResult>
  export async function refreshIndexes(vault: VaultContext, folder: string): Promise<RefreshResult>
  ```

### 14. `domain/note` mistura regras de nota com layout do vault

- **Onde**: `src/domain/note/constants.ts`, `src/domain/note/vault-path.ts`; importações de `#/domain/note` em
  `folder-index/render.ts` e `lifecycle/lifecycle.ts` só para pegar `ARCHIVE_FOLDER` e `joinVaultPath`.
- **O que está errado**: `ARCHIVE_FOLDER`, `TEMPLATES_FOLDER`, `VAULT_PATH_SEPARATOR`, `DRIVE_LETTER`,
  `RELATIVE_NAMES`, `checkVaultPath`, `checkMemoryFolder`, `ancestorFolders` são sobre caminhos no vault, não sobre
  nota. O `constants.ts` de `note` junta quatro assuntos: frontmatter, layout do vault, regras de nome do Windows e
  links do Obsidian.
- **Por que está errado**: "one folder per topic". Quem procura a regra de caminho não pensa em `note/`; e
  `folder-index` e `lifecycle` dependem de `note` por algo que não é nota.
- **Versão correta**: `domain/vault-path/` (constants, `vault-path.ts`) e `domain/names/` (regras de nome de arquivo
  e de link, usadas por `note` e por `vault-path`). Do mesmo jeito, `memoryConfigPath`, `MEMORY_FOLDER_NAME` e
  `CONFIG_FILE_NAME` saem de `pi/memory-add/` (não são assunto da ferramenta) para um módulo `pi/paths/`.

---

## 🟡 Tipos

### 15. Tipos catch-all: `object` em três lugares

- **Onde**: `src/pi/types.ts:5` (`event: object`), `src/pi/extension.ts:17` (`_event: object`),
  `src/services/search-index/search.ts:41` (`row: object`).
- **O que está errado**: `object` aceita qualquer formato. O `AGENTS.md` global lista `object` explicitamente como
  `any` com outro nome.
- **Por que está errado**: o compilador para de ajudar justamente na fronteira com bibliotecas externas.
- **Versão correta**:
  - pi: usar o tipo que o próprio pi exporta.

    ```ts
    import type { ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent"

    export type SessionStartHandler = (event: SessionStartEvent, ctx: ExtensionContext) => void
    ```

  - SQLite: dar nome ao tipo exato da linha que o `node:sqlite` devolve e validar a partir dele.

    ```ts
    export type IndexRow = ReturnType<StatementSync["all"]>[number]

    function toSearchHit(row: IndexRow): SearchHit
    ```

### 16. Um único `VaultFailureReason` para todas as operações

- **Onde**: `src/services/vault/types.ts:38-49, 62-76`.
- **O que está errado**: todo resultado do vault usa o mesmo `VaultRefusal`, com os 7 motivos. `ResolveResult`
  "pode" devolver `exists` ou `conflict`; `CheckResult` é usado para coisas muito diferentes.
- **Por que está errado**: o tipo não diz o que cada operação realmente pode recusar. O chamador não consegue tratar
  só os casos possíveis, e um `switch` exaustivo fica impossível de escrever com sentido.
- **Versão correta**: motivos por operação, compostos.

  ```ts
  export type ResolveRefusalReason = "invalid" | "outside-vault" | "vault-missing"
  export type CreateRefusalReason = ResolveRefusalReason | "exists" | "not-writable"
  export type UpdateRefusalReason = ResolveRefusalReason | "conflict" | "not-writable"
  ```

### 17. Discriminação por `in` em vez de discriminante; `respondTo` não é exaustivo

- **Onde**: `src/pi/memory-add/respond.ts:10` (`"existing" in result`),
  `src/domain/note/frontmatter-fields.ts:31` e `frontmatter.ts:157` (`"problems" in field`),
  `src/shared/result/types.ts`.
- **O que está errado**: `Failed` e `Absent` têm o mesmo discriminante (`succeeded: false`); `VaultRefusal` e
  `ExistingMemoryRefusal` têm o mesmo `reason: "exists"`. Para separar, o código pergunta se uma propriedade existe.
  E `respondTo` termina num "resto" genérico.
- **Por que está errado**: `in` não é discriminação de união; o TypeScript não garante exaustividade. Um motivo novo
  cai no "resto" sem nenhum aviso do compilador.
- **Versão correta**: discriminantes únicos e `switch` com checagem de exaustividade.

  ```ts
  export interface ExistingMemoryRefusal extends Failed {
    reason: "exists-with-note"
    existing: StoredNote
  }

  export function respondTo(result: AddMemoryResult): MemoryAddResponse {
    if (result.succeeded) {
      return replySaved(result.output)
    }

    switch (result.reason) {
      case "exists-with-note":
        return reply(describeExisting(result), true)
      case "invalid":
        return reply(describeInvalid(result.problems), true)
      case "no-project":
        return reply(describeNoProject(result), true)
      case "not-configured":
      case "invalid-config":
      case "exists":
      case "conflict":
      case "not-writable":
      case "outside-vault":
      case "vault-missing":
      case "not-found":
        return reply(result.problems.join("\n"), true)
    }
  }
  ```

  Para `Absent`, o mesmo raciocínio: ou um discriminante próprio, ou funções que nunca precisem distinguir
  `Failed` de `Absent` pela presença de `problems`.

---

## 🟡 Duplicação e desenho local

### 18. A lista de campos do frontmatter existe em 6 lugares

- **Onde**: `NoteFrontmatterSchema` (`schemas.ts`), `KNOWN_FRONTMATTER_FIELDS` (`constants.ts:7`), `readFields`,
  `fieldProblems` e `buildFrontmatter` (`frontmatter.ts`), `orderedFrontmatter` (`render.ts`).
- **O que está errado**: os oito nomes de campo estão escritos à mão seis vezes; `readDontForget` ainda tem
  `"dontForget"` literal.
- **Por que está errado**: adicionar um campo (o doc já prevê `schemaVersion` no futuro) exige lembrar de seis
  lugares. Esquecer `KNOWN_FRONTMATTER_FIELDS` faz o campo novo virar "not a known field"; esquecer
  `orderedFrontmatter` faz o campo sumir ao gravar.
- **Versão correta**: uma fonte de verdade. A ordem de gravação e o conjunto de nomes saem do schema
  (`Object.keys(NoteFrontmatterSchema.properties)` preserva a ordem de declaração), e um único descritor por campo
  (nome, schema, obrigatório ou não, leitor) alimenta `readFields`, `fieldProblems` e `buildFrontmatter`.

### 19. Validação e busca repetidas no fluxo de criação

- **Onde**: `create.ts:17-28`, `relocate.ts:31-50` + `create.ts:25-42`, `add-memory.ts:28-31`.
- **O que está errado**:
  - `createMemoryNote` roda `checkNote` e chama `createNote`, que roda `checkNote` de novo;
  - `relocateNote` checa nota e nome livre em `checkRelocation` e depois `createNote` checa tudo de novo;
  - `createNote` acha o arquivo existente (`existing.output`) e devolve só uma string; `addMemory` então chama
    `findNote` para achar o mesmo arquivo outra vez.
- **Por que está errado**: trabalho em dobro, e duas fontes de verdade para a mesma regra num mesmo fluxo. Se um dia
  as duas checagens divergirem, o erro reportado depende de qual rodou primeiro.
- **Versão correta**: uma função interna que só grava (pressupondo nota validada), chamada pelas públicas depois de
  validarem uma vez; e a recusa `exists` carregando o nome real do arquivo encontrado, para o usecase ler a nota
  direto com `readNote`.

### 20. `files.ts`: o mesmo try/catch 5 vezes e um nome enganoso

- **Onde**: `src/services/vault/files.ts` (`readRawFile`, `linkStatOf`, `realPathOf`, `linkTargetOf`,
  `entriesOf`, e `writeAtomically`/`removeFile`).
- **O que está errado**: cinco funções com o mesmo esqueleto "tenta, se o código for X devolve ausente, senão
  relança". `linkTargetOf` não lê o alvo do link (`readlink`): faz `realpath`, igual a `realPathOf`, só com outro
  filtro de erro. `notWritableCodeOf` repete `"code" in error` dentro do laço.
- **Por que está errado**: duplicação que esconde a diferença real entre as funções (só o conjunto de códigos), e um
  nome que descreve outra operação.
- **Versão correta**: um helper `hasCode(error, codes)` e nomes pelo que fazem: `realPathOf` (ausente em `ENOENT`)
  e `resolvedLinkOf` (ausente em `ENOENT`/`ELOOP`). Ex.:

  ```ts
  function hasCode(error: Error, codes: string[]): boolean {
    return "code" in error && typeof error.code === "string" && codes.includes(error.code)
  }
  ```

### 21. Normalização de caminho duplicada entre domain e search-index

- **Onde**: `src/domain/config/paths.ts:28-34` e `src/services/search-index/open.ts:38`.
- **O que está errado**: `replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()` aparece nos dois lugares.
- **Por que está errado**: a regra "o mesmo vault, escrito de jeitos diferentes, é o mesmo vault" vive em dois
  lugares e pode divergir: o projeto achado por `resolveProject` e o arquivo de índice escolhido por `indexFileFor`
  deixariam de concordar.
- **Versão correta**: exportar `comparablePath` do domínio e usá-lo em `indexFileFor`.

### 22. Duplicações menores em `domain/note` e `services/vault`

- `readDontForget` é `readOptionalField` com outro leitor (`frontmatter-fields.ts:38-75`) → uma função recebendo o
  leitor do valor.
- Duas funções `problemsOf` diferentes (`frontmatter.ts:156`, `frontmatter-fields.ts:173`) → uma só.
- `Pair<ParsedNode, ParsedNode | null>[]` repetido oito vezes → `export type FrontmatterPairs = …` em `types.ts`.
- `readFlag` testa `typeof node.value === "boolean"` antes de `Value.Check(DontForgetSchema, …)`, que já cobre isso.
- `"index.md"` é montado em `refresh.ts:77` (`indexFileName()`) e de novo em `list.ts:55` → constante
  `FOLDER_INDEX_FILE_NAME` em `vault/constants.ts`.
- `displayPath` é só um apelido de `joinVaultPath` (`paths.ts:8`) → usar `joinVaultPath`.
- `refreshFolders` (`relocate.ts:106`) chama `refreshIndexes` por pasta, e cada chamada sobe até a raiz: o
  `index.md` da raiz é reescrito duas ou três vezes por arquivamento → juntar o conjunto de ancestrais e escrever cada
  índice uma vez.
- `contentsOf` (`refresh.ts:70`) usa `findFileIgnoringCase` para saber se existe a **pasta** `archive`; um arquivo
  chamado `archive` também conta.
- `aQuestion()` em `tests/helpers/note.ts:76` redefine o `id` com o mesmo valor que já tinha.

### 23. Índice FTS5: apagar por `id UNINDEXED` varre a tabela inteira

- **Onde**: `src/services/search-index/open.ts:26-31`, `write.ts:23,33`.
- **O que está errado**: `notes_fts` guarda `id` como coluna `UNINDEXED` e `putNote`/`removeNote` fazem
  `DELETE FROM notes_fts WHERE id = :id`. FTS5 não indexa colunas `UNINDEXED`: cada escrita é uma varredura completa.
  O texto também é guardado duas vezes (em `notes` e em `notes_fts`).
- **Por que está errado**: o custo de cada escrita cresce com o número de notas, e a sincronização com o vault (marco
  2) vai fazer muitas escritas.
- **Versão correta**: FTS5 com conteúdo externo ligado pelo `rowid` da tabela `notes`.

  ```sql
  CREATE VIRTUAL TABLE notes_fts USING fts5(
    statement, body,
    content = 'notes', content_rowid = 'rowid',
    tokenize = 'porter unicode61'
  );
  ```

  Removendo pelo `rowid` (operação `'delete'` do FTS5 com conteúdo externo), sem varredura e sem texto duplicado.
  Junto disso, uma versão de esquema (`PRAGMA user_version`) para reconstruir o índice quando o esquema mudar — hoje
  `CREATE TABLE IF NOT EXISTS` mantém em silêncio um esquema antigo.

### 24. Objetos `Intl` e `prepare()` recriados a cada chamada ⚪

- **Onde**: `folder-index/render.ts:88` (um `Intl.Collator` **por comparação** do sort), `note/check.ts:57`
  (`Intl.Segmenter` por chamada), `search-index/write.ts` e `search.ts` (`prepare` por chamada).
- **Por que está errado**: custo desnecessário em caminhos quentes (ordenar, validar, indexar).
- **Versão correta**: criar o collator e o segmenter uma vez em `constants.ts`; preparar os statements no
  `openIndex` (item 11).

### 25. Estratégia de erro inconsistente (exceção vs. resultado)

- **Onde**: `search-index/errors.ts` + `search.ts:43`; `create.ts:37` (`mkdir`); `files.ts:91-93`.
- **O que está errado**: o projeto modela falhas como resultados, mas: índice com linha inválida **lança**
  `SearchIndexCorruptedError` (que ninguém captura); `mkdir` com `EPERM` lança; e o `rm` no `finally` de
  `writeAtomically` pode lançar e **esconder** o erro original.
- **Por que está errado**: o chamador não sabe, pelo tipo, o que pode falhar. Um erro de limpeza mascarando o erro
  real dificulta diagnóstico.
- **Versão correta**: índice corrompido é uma condição esperada (o doc diz que o índice "can always be rebuilt"):
  `searchText` devolve `{ succeeded: false, reason: "corrupted" }` e o usecase reconstrói. `mkdir` passa pela mesma
  tradução `not-writable`. O `rm` de limpeza não deve substituir o erro principal.

### 26. Mensagens cruas do TypeBox e um filtro "mágico" ⚪

- **Onde**: `src/domain/validation/describe.ts:14-16`.
- **O que está errado**: as mensagens que chegam ao LLM/usuário são as do TypeBox
  (`id: must match pattern "^[0-7][0-9A-HJKMNP-TV-Z]{25}$"`); e `if (error.keyword === "boolean") return []` descarta
  erros sem dizer por quê — num projeto sem comentários, o nome precisa explicar.
- **Versão correta**: mensagens do domínio por campo (`id: must be a ULID`, `created: must be a date (YYYY-MM-DD)`)
  e uma função com nome que explique o filtro (ex.: `isRepeatOfAnotherError`), com teste em
  `tests/domain/validation/describe.test.ts`.

---

## 🟡 Testes

### 27. Espelhamento quebrado, testes de constantes, helpers duplicados

- **Espelhamento** (`AGENTS.md`: `tests/` espelha `src/`): `src/domain/config/paths.ts` é testado por
  `resolve.test.ts` e `vault-name.test.ts`; não há teste em caminho espelhado para `domain/note/names.ts`,
  `domain/validation/describe.ts`, `pi/memory-add/respond.ts`, `services/search-index/write.ts`,
  `services/vault/files.ts` e `services/vault/relocate.ts` (que tem a lógica mais delicada do vault). O `ROADMAP`
  reconhece, mas continua sendo dívida.
  → `tests/domain/config/paths.test.ts`, e um arquivo por módulo com lógica.
- **Testes de constante** (`AGENTS.md`: "Pure wiring, types and constants need no test"): em
  `tests/pi/memory-add/memory-add.test.ts`, "asks for every parameter…" verifica `enum` com 12 itens e a existência
  de `description`, e "asks for … in English" verifica o texto das descrições. Só falham se alguém mudar a constante
  de propósito.
  → remover, ou trocar por algo que pode quebrar sem intenção (ex.: os parâmetros do schema da ferramenta e o request
  do usecase cobrem os mesmos campos).
- **Helpers duplicados**: `const limits = { maxBodyChars: 1000, maxStatementChars: 100 }` em ~12 arquivos de teste e
  dentro de `readBack`, enquanto `aConfig().limits` já existe; `useTempVault` (vault.ts) e `useTempFolder`
  (search-index.ts) fazem a mesma coisa, e `useTempVault` é usado para pastas que não são vault (config).
  → `aLimits()` e um único `useTempFolder()` em `tests/helpers`.
- **Teste do pi dois andares abaixo**: `memory-add.test.ts` importa `readNote` de `#/services` para verificar o disco.
  O teste do pi deve provar a tradução de entrada/saída; o efeito no disco já é provado no teste do usecase.

### 28. Testes ausentes para os caminhos de falha

Os bugs 1–6 passaram porque nenhum teste exercita estes caminhos:

- pasta inexistente em `listFolder`/`refreshIndexes` (item 1);
- nota gravada com falha no índice (`index.md` somente leitura ou link para fora) em `addMemory` (itens 2 e 3);
- nota criada por terceiros entre a checagem e a gravação (item 4) — dá para simular gravando o arquivo antes do
  `publish` com a primitiva separada;
- nota que é link para fora e pasta-link interna em `listFolder` (item 5);
- segunda gravação de `relocateNote` falhando com `not-writable` (item 6);
- `mkdir` em pasta somente leitura.

Pelo `AGENTS.md` (TDD, bug fix começa pelo teste que reproduz), cada correção começa por esses testes, vermelhos.

---

## ⚪ Docs e configuração

### 29. Docs e `package.json` divergindo do código

- `README.md`: "The extension loads but has no features yet" — `memory_add` existe.
- `vault-format.md`: "the usual refusals change nothing" (item 6), "never overwrites" (item 4), links seguidos mas
  pastas-link fora do índice (item 5).
- `package.json`: `"peerDependencies": { "@earendil-works/pi-coding-agent": "*" }` aceita qualquer versão, inclusive
  as que quebram a API usada; o dev usa `1.0.1` → declarar a faixa testada (ex.: `"^1.0.1"`).
- `tsconfig.json` inclui `scripts/**/*.ts`, pasta que não existe.
- `extension.ts:17`: a notificação "pi-obsidian-memory loaded" a cada sessão é ruído de depuração para o usuário; o
  smoke test pode provar o carregamento pela ferramenta registrada.

---

## Ordem sugerida de correção

1. **Bugs 1–6**, cada um com o teste que o reproduz primeiro (item 28).
2. **Itens 3, 16 e 17** juntos: são o mesmo trabalho de tipos de resultado e destravam o `respondTo` exaustivo.
3. **Itens 7, 8, 9, 12 e 13**: reorganização de camadas (domínio puro, recurso `file-system`, barrel público,
   `VaultContext`). Melhor antes do marco 2, que vai adicionar `memory_search` e `memory_get` sobre esta base.
4. **Itens 10 e 29**: textos e docs — é o escopo do marco 0 do `ROADMAP`.
5. **Itens 11, 23 e 24**: índice de busca, antes de ligá-lo a qualquer ferramenta.
6. **Itens 14, 18–22, 25–27**: limpeza local.

---

## Contrarrevisão das afirmações

### Base e alcance da verificação

- Base: commit `9408837`. No início desta conferência, `git status --short` mostrava somente
  `?? docs/REVISAO-DE-CODIGO.md`. Portanto, a árvore desta conferência não estava limpa; isso não permite concluir
  qual era o estado na revisão anterior. A afirmação do ROADMAP de que o trabalho de frontmatter está parcialmente
  staged também não descreve este checkout.
- Executados novamente: `npm run lint`, `npm run typecheck` e `npm test`: todos passaram; **380 testes em 32
  arquivos**. Não executei `npm run test:pi`: não houve alteração da extensão, atualização do pi ou release.
- Conferidos os módulos e testes relacionados às afirmações, além dos contratos em `AGENTS.md`, `ROADMAP.md`,
  `config.md` e `vault-format.md`. Isto não é uma garantia de ausência de outros defeitos.
- Reproduções adicionais foram executadas com Node e filesystem real em diretórios criados por `mkdtemp` dentro
  do temporário do sistema, removidos em `finally`. Nenhum vault/config do usuário foi usado. Não foram adicionados
  testes permanentes nem alterada a implementação; as reproduções não substituem os testes de regressão em TDD.
- O ROADMAP declara que os docs de produto descrevem o comportamento-alvo. Busca, atualização e lifecycle existem
  como código, mas ainda não são ferramentas. Uma lacuna de marco futuro não é, por si só, bug da ferramenta atual.
  Já perda de dados ou incoerência nas operações existentes continua sendo defeito relevante.

### Correções e ressalvas aos itens 1–29

#### Itens 1–3: bugs confirmados; precisão sobre o resultado

- Reproduzidos `ENOENT` em `listFolder(vault, "missing", limits)` e
  `refreshIndexes(vault, "missing/deep", name, limits)`. Aceitar destino ainda inexistente em `resolveFolder` é
  necessário para criar pastas; não se deve fazer o resolvedor recusar toda ausência para corrigir a listagem.
- Reproduzido `addMemory` salvando `Saved.md` e retornando
  `{ succeeded: false, reason: "not-writable", problems: ["index.md leads outside the vault"] }`, com `index.md`
  sendo uma junction externa. O problema dos itens 2 e 3 é real.
- **Correção da descrição do item 2:** nesse caminho `respondTo` não escreve literalmente “Not saved”; ele devolve
  o problema do índice com `isError: true`. A ambiguidade sobre a persistência existe, mas a frase literal só aparece
  em outros ramos. Tampouco se pode afirmar que o LLM necessariamente repetirá a chamada.
- A solução com `indexProblems` cobre apenas recusas retornadas. `readdir`, leitura e limpeza também podem lançar
  depois da gravação. O contrato precisa informar que a nota foi salva mesmo nessas falhas de manutenção, sem
  transformar qualquer erro indiscriminadamente em sucesso nem prometer índices atualizados.

#### Itens 4 e 6: há também risco na remoção; rollback não equivale a transação

- O `rename` sem exclusividade e a gravação sequencial estão confirmados no código. Não foi executado um teste
  concorrente para forçar a janela do item 4; a conclusão decorre da sequência de operações, não de uma corrida
  reproduzida nesta conferência.
- **A frase “Não perde dados” do item 6 é ampla demais.** Em `relocate.ts`, `removeOriginal` confere o hash, resolve
  novamente o caminho e só depois chama `removeFile`. Uma edição entre a leitura de conferência e o `rm` pode ser
  apagada; as cópias já gravadas contêm a versão anterior. É outra janela de checagem-uso, além das de links e update.
- `link(temp, destino)` impede substituição do destino exato quando já existe, mas não encerra sozinho a política
  case-insensitive em diretórios configurados como case-sensitive. É preciso explicitar o filesystem suportado.
  O exemplo também mantém a possibilidade de a limpeza lançar **depois de publicar com sucesso**, repetindo o
  problema de resultado ambíguo. Não deve haver fallback silencioso para uma gravação com garantia mais fraca.
- Remover as cópias por hash num rollback também tem janela entre comparar e remover. É preciso preservar uma
  eventual edição posterior do usuário e representar falha da compensação/estado parcial. “Tudo foi validado antes”
  não garante permissões, nomes livres ou conteúdo inalterado durante a operação.
- Os snippets do documento são esboços, não patches: vários usam comentários, embora o projeto proíba comentários
  no código. A implementação terá de explicar o fluxo por estrutura e nomes.

#### Item 5: a omissão de symlinks começa antes de `addToListing`

- `isNoteFile` exige `entry.isFile()`. Um symlink de arquivo é eliminado nessa etapa, seja interno ou externo;
  normalmente ele nem chega a `readNote` ou a `addToListing`. O descarte de outros motivos por `addToListing`
  continua existindo, mas não é a causa inicial da omissão do symlink descrito no item.
- Reproduzido: `Alias.md` apontando para `Target.md` interno não aparece em `listFolder`, embora `readNote` leia
  `Alias` normalmente. Junctions de pasta também não aparecem como subjects.
- Mudar apenas `addToListing` não resolve. A enumeração precisa classificar links por seu alvo, dentro do vault,
  tratar links quebrados/externos e definir como reportar problemas de pastas, pois `invalid` hoje representa notas.

#### Itens 7–9 e 12: as soluções precisam respeitar a própria escada

- Estão confirmados os imports laterais em `services/memory/draft.ts` e `services/config/read.ts`, bem como o barrel
  amplo de vault. Porém criar `services/file-system` e fazer `services/vault` e `services/config` importá-lo
  **mantém a dependência services → services** criticada no documento. Não resolve a regra estrita do AGENTS.
- Da mesma forma, mover `newNote` para domain e fazer o usecase importá-la diretamente pula services. É necessário
  definir uma API que respeite a escada, ou pedir uma decisão explícita de arquitetura; não basta mover arquivos.
  `shared` também não é uma saída automática: sua regra só admite tipos genéricos de resultado.
- `biome/layer-services.grit` proíbe imports de usecases/pi, mas não imports laterais entre services. Logo, lint
  verde não demonstra que a restrição “only the one right below it” está integralmente implementada.
- Ler relógio/id dentro de um service não é, isoladamente, defeito: services são a camada de recursos. O problema
  específico é a responsabilidade de `memory`, sua composição lateral e a convenção inconsistente de dependências.

#### Itens 10, 13 e 14: diagnóstico mantido, propostas de desenho

- Confirmados os comandos inexistentes, as ordens distintas dos argumentos e as regras de caminhos dentro de
  `domain/note`. `VaultContext` e a divisão por assunto são propostas de desenho, não correções obrigatórias únicas.
- `VaultTarget` contém só `path` e `name`, não `limits`; não é exatamente o contexto completo sugerido no item 13.
  Serviços que não usam nome de exibição não precisam recebê-lo só para uniformizar todas as assinaturas.

#### Item 11: a interface proposta não é opaca

- `export interface SearchIndex { database: DatabaseSync; statements: IndexStatements }` continua permitindo
  `index.database.exec(...)` a qualquer consumidor. Não satisfaz a promessa de “única forma de usá-lo” por operações
  de domínio. Tampouco o alias atual impede tecnicamente um cache de statements; ele apenas não o oferece.
- Encapsular o handle de verdade: implementação com estado privado e API pública apenas com operações permitidas,
  incluindo fechamento. Se os statements forem cacheados, o cache deve acompanhar o ciclo de vida da conexão.

#### Item 15: `IndexRow` apenas renomeia outro catch-all

- Os três usos de `object` citados existem. Entretanto, em `@types/node/sqlite.d.ts`, `StatementSync.all` retorna
  `Record<string, SQLOutputValue>[]`. O `ReturnType<StatementSync["all"]>[number]` proposto não descreve uma linha
  exata e continua infringindo a regra contra transportar tipos abertos da biblioteca.
- `toSearchHit` já valida a linha com `Value.Check(SearchHitSchema, row)` antes de devolvê-la. Portanto, não há
  ausência de validação SQLite nesse ponto. A correção deve manter a validação na fronteira e deixar sair apenas
  `SearchHit`, sem criar um alias aberto com aparência de tipo específico.

#### Itens 16 e 17: narrowing por `in` é válido; exaustividade é outra questão

- **“`in` não é discriminação de união” está incorreto.** TypeScript estreita uniões pela presença de uma propriedade;
  o código usa esse recurso legitimamente. O que `in` não garante é tratamento exaustivo de todos os motivos futuros,
  assim como um `if` isolado sobre `reason` também não garante.
- Separar ausência de falha diagnosticada e especializar recusas pode melhorar o contrato. Isso não torna toda
  checagem de propriedade um bug. O ramo genérico de `respondTo` é uma escolha de apresentação comum, não evidência
  de comportamento errado para um motivo existente.
- Especializar os motivos do item 16 é uma melhoria de precisão, não prova de que hoje sejam retornados motivos
  impossíveis por todas as operações. As uniões devem acompanhar todos os caminhos reais. Exaustividade pode ser
  assegurada por `never` ou pelo retorno obrigatório sob `strictNullChecks`, sem fallback que esconda novos casos.

#### Itens 18–22: nem toda repetição deve ser extraída

- Há repetição dos campos, da normalização e dos helpers citados. Derivar os nomes conhecidos do schema reduz uma
  duplicação concreta. Já um descritor heterogêneo único de leitores pode exigir casts/tipos abertos e piorar a
  clareza; não está demonstrado que substituir toda montagem explícita seja um ganho.
- **Item 19:** validar estrutura duas vezes é diferente de reconferir filesystem mutável. Não remover as checagens
  de nome livre/links de `createNote` simplesmente porque `checkRelocation` já as fez. A pré-validação reduz recusas
  tardias; a verificação próxima da escrita reduz a janela concorrente. Nenhuma substitui publicação exclusiva.
- **Item 22:** o `typeof node.value === "boolean"` não é só duplicação do schema. É uma restrição explícita do
  payload de `yaml` na fronteira, coerente com a regra de não passar adiante o tipo aberto da biblioteca. Removê-lo
  precisa manter essa validação, não apenas depender do tipo aceito por `Value.Check`.
- As duas `problemsOf` aceitam uniões diferentes (`FieldResult` e `OptionalFieldResult`); reuni-las é uma opção de
  desenho, não uma equivalência automática. O uso de `findFileIgnoringCase` para detectar uma pasta `archive` é
  um erro semântico, não só duplicação.

#### Itens 23–26: separar custo, contrato de falha e funcionalidade ainda não integrada

- Confirmadas as exclusões por coluna FTS não indexada e a preparação repetida. Não foi medido o impacto no tamanho
  esperado de vault; não há base para afirmar urgência de performance. Conteúdo externo é uma alternativa, não
  requisito: vincular a FTS por `rowid` também permite retirar a varredura sem mudar de imediato o modelo de conteúdo.
- Versão/reconstrução do schema é assunto distinto da otimização. O índice ainda não é chamado por ferramentas;
  “ninguém captura” `SearchIndexCorruptedError` não significa que `memory_add` hoje cai por esse erro.
- Falta combinar o contrato de recuperação com o marco 2. Trocar só `toSearchHit` por um resultado `corrupted` não
  trata erros lançados pelo SQLite ao abrir/preparar/consultar um arquivo corrompido. Também é preciso fechar a
  conexão se `openIndex` falhar depois de criá-la e não mascarar o erro original se `ROLLBACK` falhar.
- O projeto usa resultados para recusas esperadas, mas não estabelece que toda exceção inesperada precise ser
  convertida em resultado. O problema concreto é classificar condições esperadas e não esconder a causa/estado.
- O filtro `keyword === "boolean"` existe. Chamá-lo `isRepeatOfAnotherError` só seria correto após provar que os
  erros eliminados realmente são duplicatas. Renomear sem demonstrar isso não corrige uma possível perda diagnóstica.

#### Itens 27–29: cobertura indireta, testes de adaptação e estado dos docs

- Falta de arquivo espelhado não significa falta de cobertura: `putNote`/`removeNote` têm testes comportamentais em
  `search.test.ts` e `open.test.ts`; lifecycle é exercitado por `archive.test.ts` e `succeed.test.ts`. A dívida de
  organização permanece, mas os caminhos de falha faltantes devem ser nomeados separadamente.
- O teste pi “passes every parameter on to the note” verifica a tradução de parâmetros, exatamente uma obrigação
  da camada. O uso de services reais pode deixar o teste integrado demais, mas remover a asserção sem substituição
  perderia cobertura de mapeamento. Um fake de pi deve provar a chamada registrada e sua tradução.
- Reproduzidos nesta conferência os itens 1–3 e a omissão de links do 5. Corridas de escrita e a segunda escrita
  bloqueada do 6 não foram reproduzidas aqui. Há teste de arquivo read-only em `update.test.ts`; ele não cobre
  `mkdir` nem falha tardia de relocation. Não confundir os escopos.
- README desatualizado e peer dependency `*` confirmados. `^1.0.1` é uma política possível de compatibilidade, não
  uma faixa inteira comprovadamente testada só porque `1.0.1` está instalada. O include inexistente de `scripts`
  é inócuo hoje. A notificação de carregamento é comportamento documentado no estado atual, embora provisório.

### Novos achados

| # | Severidade | Tema |
|---|---|---|
| 30 | 🔴 | Nota com statement iniciado por ponto é salva e desaparece da listagem |
| 31 | 🔴 | Junction interna permite criar memória em pasta reservada |
| 32 | 🔴 | Update de symlink interno substitui o link e deixa seu alvo inalterado |
| 33 | 🔴 | Needs fixing gera wikilinks inválidos justamente para nomes inválidos |
| 34 | 🔴 | Caminho ocupado por arquivo passa pela resolução e lança `ENOTDIR` |

#### 30. Nota com statement iniciado por ponto é salva e desaparece da listagem

- **Onde:** `src/domain/note/check.ts` (`checkStatement`), `src/services/vault/create.ts` (`createMemoryNote`) e
  `src/services/vault/list.ts:17` (filtro `visible`).
- **O que está errado:** `checkNote` aceita `.Invisible`; `createMemoryNote` grava `.Invisible.md` com sucesso.
  `listFolder` elimina qualquer entrada cujo nome começa por ponto antes de classificá-la.
- **Evidência:** em vault temporário vazio, a criação retornou `succeeded: true`, seguida de listagem
  `{ subjects: [], notes: [], invalid: [] }`. Não exige concorrência, erro de disco ou edição externa.
- **Por que está errado:** a própria API cria uma nota que não estará no mapa gerado por ela. O limite a pastas
  ocultas não resolve o nome de arquivo oculto; trata-se de um caso adicional ao item 5.
- **Versão correta:** alinhar a política de nomes de notas com a de enumeração. Se essas notas não forem permitidas,
  recusá-las explicitamente antes de escrever e atualizar o contrato; se forem, listá-las sem incluir temporários.
  Adicionar teste de criação/listagem e do índice gerado com esse statement.

#### 31. Junction interna permite criar memória em pasta reservada

- **Onde:** `src/services/vault/create.ts` (`createMemoryNote`), `src/domain/note/vault-path.ts`
  (`checkMemoryFolder`) e `src/services/vault/resolve.ts` (`checkLinksStayInside`).
- **O que está errado:** a regra de pasta de memória olha somente o caminho escrito; a resolução física só exige
  que o alvo permaneça dentro do vault. Um alias de nome permitido para `archive/`, `_templates/` ou pasta oculta
  passa pelas duas validações.
- **Evidência:** criados `archive/` e junction `alias → archive` no vault temporário;
  `createMemoryNote(vault, "alias", note, limits)` retornou sucesso e criou `archive/Visible.md`, sem `archived`.
- **Por que está errado:** uma nova memória entra no arquivo sem lifecycle. Isso viola “never archive/ or
  _templates/ at the root” mesmo usando a operação pública recomendada no item 9.
- **Versão correta:** validar tanto o caminho lógico quanto a localização real do destino para a regra de criação
  de memória. Para caminhos novos, considerar o ancestral existente resolvido e os componentes restantes. Manter
  separada a política de leitura e a escrita de lifecycle, que precisam poder acessar archive. Testar junctions para
  cada classe de pasta reservada e também um alias para assunto permitido, que deve continuar funcionando.

#### 32. Update de symlink interno substitui o link e deixa seu alvo inalterado

- **Onde:** `src/services/vault/resolve.ts` (`resolveParts`), `src/services/vault/update.ts` e
  `src/services/vault/files.ts` (`writeAtomically`).
- **O que está errado:** o resolvedor valida o alvo real, mas retorna o caminho lógico. `readFile` segue o symlink
  final; `rename(temp, caminhoDoLink)` substitui a entrada do symlink, não o arquivo-alvo.
- **Evidência:** criados `Target.md` e `Alias.md → Target.md` internos. Após ler `Alias` e atualizar seu corpo com o
  hash retornado, `updateNote` devolveu sucesso, `lstat(Alias.md).isSymbolicLink()` passou a `false` e `Target.md`
  continuou com o corpo original. Ambas as notas ficaram com o mesmo id.
- **Por que está errado:** não é a janela concorrente já documentada. A divergência é determinística e contraria
  o contrato de seguir links internos; a leitura e a escrita operam sobre entidades diferentes.
- **Versão correta:** definir explicitamente a semântica de escrita por symlink. Para seguir o contrato atual,
  publicar no alvo resolvido e validado, preservando o link e usando temporário na pasta do alvo, sem esconder a
  janela concorrente restante. Ou recusar a operação explicitamente, se essa for a decisão de produto. Testar
  conteúdo do alvo, preservação do link e ausência de duplicação de id. Revisar também `index.md` e lifecycle para
  não aplicar uma semântica diferente silenciosamente.

#### 33. Needs fixing gera wikilinks inválidos justamente para nomes inválidos

- **Onde:** `src/domain/folder-index/render.ts` (`invalidLine`, `noteLink`, `subjectLine`) e
  `src/services/vault/list.ts`.
- **O que está errado:** o renderer interpola nomes do disco em wikilinks sem considerar que uma nota inválida pode
  ter `#`, `^`, `[` ou `]` no nome. Esses caracteres são aceitos pelo filesystem Windows e recusados pelo domínio
  precisamente porque alteram a sintaxe dos links. Nomes de subpastas vindos de `readdir` também não são validados
  antes de virar subjects.
- **Evidência:** para `Bad#name.md`, o índice produzido foi
  `- [[Bad#name|Bad#name]] · statement: "#" breaks Obsidian links`. A listagem diagnostica o problema e logo usa a
  mesma sintaxe que sabe ser inválida: `#name` é interpretado como fragmento, não parte do nome de arquivo.
- **Por que está errado:** a nota aparece como texto, mas o mapa não aponta fielmente para ela. Pastas com nomes
  incompatíveis também ganham links que a API depois recusa ao tentar resolver.
- **Versão correta:** distinguir apresentação segura de nome e link navegável. Usar texto não clicável quando um
  wikilink não puder representar fielmente o caminho, ou outra representação cuja resolução seja verificada no
  Obsidian. Não inventar escapes sem testar sua semântica. Adicionar testes com nomes inválidos reais de notas e
  pastas, verificando que o índice não publica um destino diferente do arquivo que está descrevendo.

#### 34. Caminho ocupado por arquivo passa pela resolução e lança `ENOTDIR`

- **Onde:** `src/services/vault/resolve.ts` (`checkLinksStayInside`), `src/services/vault/list.ts` e
  `src/services/vault/files.ts` (`linkStatOf`, `entriesOf`).
- **O que está errado:** `realPathOf(vault)` prova existência, não que o vault seja diretório. O percurso dos
  componentes inspeciona links, mas não exige diretório nos componentes usados como pasta. Um arquivo normal no
  caminho é aceito ou causa exceção no próximo componente.
- **Evidência:** com arquivo comum `vault/blocker`, `listFolder(vault, "blocker", limits)` lançou `ENOTDIR`, em
  vez de devolver recusa. Um config apontando o vault para arquivo também não é excluído pelo schema de strings.
- **Por que está errado:** é uma condição esperada de um vault editável pelo usuário, distinta de pasta ausente.
  Tratar apenas `ENOENT`, como sugerido no item 1, não cobre esse caminho.
- **Versão correta:** validar o tipo do vault e dos componentes de pasta, inclusive alvos de links, e traduzir as
  condições esperadas das operações efetivas em recusas próprias. Manter tratamento no I/O porque o tipo pode mudar
  depois da checagem. Testar vault que é arquivo, arquivo no meio do caminho e arquivo no lugar da pasta final,
  garantindo que não sejam alterados.

### Ajuste da prioridade de correção

1. Preservação de dados e relato de estado: itens 2–4, 6 e 32, incluindo a janela de remoção e falhas de limpeza.
2. Enumeração e destinos: itens 1, 5 e 30–34, começando cada correção pelo teste que reproduz o caso.
3. Contratos de camadas, encapsulamento e tipos: revisar as propostas dos itens 7–17 antes de implementar; não
   adotar `services/file-system`, `IndexRow` ou a interface pública com `database` como se resolvessem os problemas.
4. Manter as correções de textos/docs e o plano dos marcos; otimizações FTS/Intl e extrações de duplicação vêm com
   justificativa de desenho, não apenas para uniformizar código ou satisfazer checks.

Esta contrarrevisão não conclui nenhum item de implementação do ROADMAP; nenhum foi marcado como pronto.


## Parecer independente — Claude Opus 5.5 — 2026-10-12

Revisão solicitada pelo usuário, realizada com acesso de leitura aos arquivos do projeto (Read, Glob e Grep). Modelo confirmado no resultado: claude-opus-5-5. Sessão: b5ce2226-0aea-49fb-ae92-94ba24c6b413. O texto abaixo é o parecer do Claude, preservado como revisão independente; suas hipóteses e prioridades ainda não foram reproduzidas ou adjudicadas pelo Codex. Nenhuma correção foi aplicada nesta rodada.

# Revisão adversarial independente das mudanças pendentes de sincronização

**Veredito:** as três correções de 2026-10-12 existem no código, mas a alegação central ("cada pasta física completamente enumerada é reconferida em toda sincronização") não se sustenta em dois cenários de falha parcial. Encontrei 1 defeito P1, 3 P2 e 6 P3.

**Limites desta revisão:**
- Usei apenas Read, Glob e Grep. Não executei testes, lint, typecheck nem comandos, e não alterei nenhum arquivo.
- Todos os achados vêm de leitura estática do working tree, inclusive os arquivos untracked. "Confirmado" significa confirmado por leitura do caminho de código, não por reprodução.
- Li a seção de 2026-10-12 de `docs/REVISAO-DE-CODIGO.md` inteira (linhas 3–47) e o histórico até a linha 766 de 958.
- Não tenho como confirmar os números do Codex (150 arquivos, 1.122 testes).

## Achados

### P1 — Uma pasta com nome não representável cancela toda a manutenção de índices do vault

- **Onde:** `src/usecases/synchronize-memory/leased/maintenance.ts:6-8`; `src/services/vault/refresh-folders.ts:53-57`; `src/domain/vault-path/vault-path.ts:41-52`; `src/domain/names/constants.ts:5`.
- **Cenário:** o vault tem `c#/Note.md` (ou `notes [2024]/`, `issue #12/`) e `topic/Note.md`.
  1. A enumeração aceita a pasta, porque `isSafeCatalogPath` só rejeita `\`, `:`, `.`/`..` e NUL (`classify.ts:35-37`), e a inclui em `completeDirectories` (`enumerate.ts:39`).
  2. O usecase passa todas as pastas a `refreshFolders`.
  3. `planRefreshFolders` chama `resolveFolder` para cada uma; `checkVaultPath` recusa `#`, `^`, `[`, `]` e a função retorna na primeira recusa, antes de qualquer escrita.
- **Impacto:** nenhum `index.md` do vault é criado ou atualizado, nem o da raiz, em toda sincronização, até o usuário renomear a pasta. O catálogo é publicado e só aparece um aviso.
- **Por que é regressão:** antes a pasta só entrava no lote quando era tocada; agora entra sempre. O próprio `listFolder` já trata esse caso como pasta problemática em "Needs fixing" (`list.ts:81-85`).
- **Cobertura:** nenhum teste de sincronização usa pasta com esses caracteres; só arquivos (`[bad].md`).
- **Correção mínima:** em `refreshFolders`, acumular a recusa por pasta e continuar. Teste vermelho: `c#/Note.md` + `topic/Note.md` deve gerar `topic/index.md` e listar `c#` em "Needs fixing" na raiz.

### P2 — A primeira falha de escrita interrompe as pastas restantes

- **Onde:** `src/services/vault/refresh-folders.ts:22-26`.
- **Cenário:** a ordem de escrita é a raiz e depois as pastas em ordem alfabética. Se `a/index.md` está read-only ou bloqueado e precisa mudar, `b/`, `c/` e as seguintes não são reconferidas enquanto a falha durar. O mesmo vale para falha de `listFolder` ou link de índice que não resolve.
- **Caso agravado:** a guarda nova de `refresh-folders.ts:94-96` (índice que aponta para uma nota) é uma falha permanente. Quando ocorre na raiz, que é a primeira, bloqueia o vault inteiro; `tests/usecases/synchronize-memory/leased/synchronize.test.ts:106-118` fixa só o aviso, com uma única pasta.
- **Impacto:** o achado P1 da revisão foi corrigido para a pasta que falhou, mas a falha agora se propaga às demais. Os testes de retry usam vaults de uma pasta só.
- **Correção mínima:** a mesma do P1 (continuar e agregar problemas), com teste de duas pastas em que uma está read-only.

### P2 — Cancelamento e sessão obsoleta não interrompem a manutenção

- **Onde:** `src/usecases/synchronize-memory/leased/maintenance.ts:7-8`; `src/services/vault/refresh-folders.ts:13-43` (não recebe sinal).
- **Cenário:** o usuário aborta, ou a configuração muda (`stale-session`), logo após a publicação do catálogo. A interrupção é checada uma vez; depois o serviço lê todas as notas e escreve todos os índices até o fim.
- **Impacto:**
  - Escritas no vault continuam depois do cancelamento, inclusive num vault que acabou de sair da configuração.
  - O lease da sessão fica retido durante todo o percurso.
  - O resultado diz `cancelled`, mas os arquivos continuaram mudando.
- **Cobertura:** os testes de cancelamento só cobrem aborto antes de qualquer trabalho (`synchronize.test.ts:20-59`).
- **Correção mínima:** `refreshFolders` receber uma sonda de continuação consultada antes de cada `writeIndex`.

### P2 — A reconferência lê todas as notas a cada sincronização (limite documentado, mas subdimensionado)

- **Onde:** `maintenance.ts:6`; `src/services/vault/list.ts:56-63`; `src/services/vault/read.ts:15`.
- **Confirmado:** o scan do catálogo evita ler arquivos inalterados (`inspection.ts:17`), mas a manutenção chama `readNote` para cada nota de cada pasta. O "aumenta as leituras" do ROADMAP é, na prática, leitura e parse integral do vault "no início da sessão e antes de cada busca".
- **Confirmado:** uma nota inalterada porém ilegível mantém a linha no catálogo, mas o `index.md` da pasta é reescrito com "Needs fixing: cannot be read" e reescrito de novo quando ela volta. `tests/usecases/synchronize-memory/leased/inspection.test.ts:32-35` passa por esse caminho sem verificar o índice.
- **Risco hipotético (não reproduzido):** em vault no OneDrive, o `index.md` passa a refletir condições transitórias de cada máquina (bloqueio, arquivo só na nuvem). Duas máquinas podem reescrevê-lo alternadamente e gerar cópias de conflito.
- **Correção mínima:** medir antes de ligar à busca. Alternativa: persistir as pastas pendentes de manutenção e reconferir só essas, as tocadas e as sem índice.

### P3 — Aliases estáveis são tratados como falha de cobertura

- **Onde:** `src/usecases/synchronize-memory/leased/scan.ts:23,26`; `src/services/vault/catalog/visit.ts:46-57`; `src/domain/search-catalog/coverage.ts:10`.
- **Cenário:** `tools/` (com linhas em cache) é trocada por uma junction para `.stash/tools`. A enumeração registra `excluded` em `failures`, e o scan converte em `failedPaths`.
- **Impacto:** as linhas `tools/*.md` nunca são retiradas e continuam pesquisáveis; a cobertura fica `degraded` para sempre. Uma junction para um ancestral (`cycle`) tem o mesmo efeito na cobertura.
- **Inconsistência:** alias para `_templates` segue o caminho correto de retirada (`aliases.ts:40-43`).
- **Correção mínima:** em `scan.ts`, tratar falhas `excluded` da enumeração como exclusão positiva, sem marcar o scan incompleto.

### P3 — Alias de índice para índice de outra pasta gera conteúdo errado ou regravação perpétua

- **Onde:** `src/services/vault/refresh-folders.ts:94-99`.
- **Cenário:** é o fixture de `tests/services/vault/refresh-folders.test.ts:34-45` (`index.md` da raiz apontando para `physical/INDEX.MD`), agora sob sincronização.
  - Com a mesma caixa, o conteúdo da raiz vence e o índice de `physical` nunca é renderizado, sem aviso.
  - Com caixa diferente, a deduplicação por string falha (`…/INDEX.MD` contra `…/index.md`) e o arquivo é regravado duas vezes por sincronização.
- **Correção mínima:** aceitar o alias só quando o destino é o índice da própria pasta resolvida.

### P3 — Aliases de diretório aninhados: sincronização e add/lifecycle divergem

- **Onde:** `refresh-folders.ts:59-63`; fixado em `tests/services/vault/refresh-folders.test.ts:103`.
- **Cenário:** via `alias/child`, `physical/subject/index.md` recebe o título `# alias`. A sincronização passa só pastas físicas e o renderiza como `# physical/subject`.
- **Impacto:** os dois fluxos regravam o mesmo arquivo alternadamente. Só ocorre com alias dentro do destino de outro alias.

### P3 — Resíduos e divergência de documentação

- `touchedFolders` (`src/domain/search-catalog/plan.ts:32-34`, `types.ts:48`) não tem mais consumidor em `src/`.
- `docs/vault-format.md:5-6` ainda descreve a sincronização como comportamento-alvo, e a linha 94 diz que só pastas tocadas são regeneradas.
- `vault-format.md` não menciona a recusa de alias de índice para não-índice nem a preservação de índice idêntico.

### P3 — Camadas e tipos

- Não há import de `#/domain` no usecase, nem comentários ou tipos abertos nos arquivos novos, nem mocks de filesystem nos testes inspecionados.
- Regras puras ficaram na camada de usecase: o mapeamento arquivo → entrada (`entry.ts:14-23`), a política de reuso por stat (`inspection.ts:35-41`) e a classificação de falhas de alias (`aliases.ts:39-48`). Pelo AGENTS.md, pertencem ao domínio.
- `writeChangedIndex` (`refresh-folders.ts:116-120`) não declara tipo de retorno e usa `as const`.

### P3 — Lacunas de teste

- Não há teste direto de `refreshFolders` com várias pastas.
- Não há teste de falha em uma pasta com outras saudáveis.
- Não há teste de cancelamento durante a manutenção.

## Conferência das alegações de 2026-10-12

| Alegação | Veredito |
|---|---|
| P1: retry de manutenção após publicar o catálogo | Verdadeira para a pasta que falhou (`maintenance.test.ts:35-56`); incompleta pelos dois primeiros achados |
| P2: link obsoleto após remover pasta vazia | Confirmada (`maintenance.test.ts:58-70`) |
| P2: `indexFileFor` único em `location.ts`, testes movidos | Confirmada; `open.ts` não o define mais e não há `indexPathForVault` em `src/` |
| Índice idêntico preservado | Confirmada (`refresh-folders.ts:116-120`), com as ressalvas dos achados de alias |
| Seleção antiga removida do usecase | Confirmada, mas deixou `touchedFolders` sem uso |
| Sem novo salto entre camadas | Confirmada para imports; ver a ressalva sobre regras puras |

## Verificado sem defeito

- **`indexFileFor`:** o caminho do vault chega canonizado por `realpath` (`canonicalize.ts:124-151`).
- **Catálogo:** a escrita é transacional com rollback (`storage.ts:124-162`) e a revisão avança exatamente 1.
- **Plano de mudanças:** não encontrei caminho que coloque o mesmo path em `deletes` e `upserts` ao mesmo tempo.
- **Índices em `archive/`:** são previstos em `vault-format.md:23-24`.
- **Aliases diretos como IDs duplicados:** comportamento fixado por teste (`aliases.test.ts:50-68`).
- **Limites já documentados que permanecem:** reuso por tamanho/mtime, janelas de check/use e lease sem coordenação entre processos.

## Resolução do parecer de 2026-10-12 — 2026-10-16

Todos os achados foram corrigidos com testes vistos falhando antes, exceto o P2 de leitura integral a cada
sincronização, que fica como limite a medir antes de ligar a sincronização à busca.

- P1 e P2 (pasta problemática ou com falha): `refreshFolders` registra a recusa ou falha por pasta e continua.
- P2 (cancelamento): `refreshFolders` recebe uma sonda de continuação, consultada antes de cada pasta e logo antes de
  cada escrita de índice; o usecase passa `memoryOperationInterruption`.
- P3 (aliases estáveis): falhas `excluded` e `cycle` são exclusão positiva, pela mesma regra de domínio
  (`classifyAliasFailure`) no scan e na inspeção de aliases. ELOOP comum agora é `io-error` e degrada a cobertura.
- P3 (alias de índice): só é seguido quando o destino é o `index.md` da própria pasta resolvida.
- P3 (aliases aninhados): o índice é renderizado a partir da pasta física; sync e add/lifecycle geram o mesmo arquivo.
- P3 (resíduos, camadas, tipos): `touchedFolders` removido; `semanticFingerprint` e as três regras puras foram para o
  domínio, expostas aos usecases por `services/search-index/inspection.ts`; `writeChangedIndex` tipado;
  `docs/vault-format.md` atualizado.
