# OPEN-QUESTIONS — pi-obsidian-memory

> Log de perguntas do projeto. **Regra:** uma pergunta 🔴 aberta bloqueia a aprovação de requisitos e specs.
> A entrevista de **2026-09-23** foi feita no sistema de perguntas do Claude Code, em 12 rodadas, a partir do roteiro [research/06-perguntas-abertas.md](research/06-perguntas-abertas.md).
> Status: ✅ resolvida · ⏭️ superada · 🔴 aberta e bloqueante.

**Situação:** ✅ **todas as perguntas respondidas.** Nenhuma pendente.
Quando surgirem dúvidas novas na fase de spec, registre-as aqui com o próximo ID livre (Q-N6 em diante).

## ⚠️ Decisões que fugiram da recomendação (leia antes de especificar)

| ID | Decisão do usuário | Recomendação era | Consequência para a spec |
|---|---|---|---|
| Q-N3 | "Não esquecer" **sem limite** | Prioridade + aviso | Sempre entra inteiro no prompt; o orçamento de ~3k tokens vale só para o **resto** do resumo |
| Q-B7/G6 | **Inglês** em tudo: notas, busca e detector de correções | Notas pt-BR, detecção bilíngue | Stop-words e padrões de correção do original podem ser reaproveitados. Correções digitadas em português **não** disparam o detector por regex; quem as pega é a revisão periódica feita pelo modelo |
| Q-G4 | Projeto identificado por **mapa manual** (pasta → projeto) | Raiz do git | Pasta não cadastrada = só memória global. O `/memory-init` é quem cadastra. A spec define se subpastas contam como o mesmo projeto |
| Q-E2 | **O agente pode renomear e mover** memórias | Só o usuário, pelo Obsidian | Requisito: ao renomear, o agente reescreve os `[[links]]` do vault (o Obsidian não atualiza links de renomeações feitas por fora). As referências por id não quebram |
| Q-C3 | **Busca semântica já na v1** (texto + embeddings locais) | Texto na v1, semântica na v2 | Modelo de embeddings (inglês) baixado uma vez para `~/.pi/agent/<pacote>/`, fora do OneDrive. Escolha do modelo e do armazenamento de vetores → spec/ADR |
| Q-D5 | **Segredos permitidos** | Bloquear | Vira a opção `secretPolicy: allow \| mask \| block`, com padrão `allow`. Risco aceito: segredo salvo vai para o sync configurado (ex.: nuvem do OneDrive) e pode entrar no prompt. O bloqueio de prompt injection e de unicode invisível **continua** (não foi perguntado) |
| Q-H5 | **Logs + estatísticas locais** | Só logs | Resumo local de uso (memórias, buscas, tokens injetados). Nada sai da máquina |
| Q-F3/F5/E3/E1 | **Sem Obsidian CLI** na v1 | CLI opcional | Com Q-E2, toda correção de links é feita pelo próprio agente |
| Q-H1 | **Node ≥ 24** | Node ≥ 22.13 | Pode usar `node:sqlite` e APIs recentes sem polyfill. Ver P-11 |
| Q-M6 | Repositório **público** (padrão `dev`) | Privado até o npm | Tudo o que for commitado fica público: não versionar dados pessoais, caminhos da máquina nem memórias reais (testes usam vaults fictícios) |

## Resolvidas: processo (sistema de SPEC, ou seja, como este projeto é documentado)

| ID | Pergunta | Resolução |
|---|---|---|
| Q-M1 | Método | ✅ **OpenSpec + camada `docs/` + gate de perguntas nosso** (`/entrevista` + este arquivo + regras no `AGENTS.md`) |
| Q-M2 | Onde ficam os docs do projeto | ✅ **No repositório** (`docs/` + `openspec/`). Correção do usuário: não misturar o **sistema de spec** com o **sistema de memória** (o produto). Os vaults guardam só memórias |
| Q-M3 | Agente que implementa | ✅ **pi** |
| Q-M4 | Local do repositório | ✅ Pasta local fora de qualquer sync (o `.git` corrompe em pasta sincronizada) |
| Q-M5 | Fluxo de branches | ✅ **Git Flow** com **git-flow-next**, configuração versionada em `.gitflow`. Branches: `main` (releases, tags `vX.Y.Z`), `dev` (integração), `feature/*`, `bugfix/*`, `release/*`, `hotfix/*`. Nada de commit direto em `main` ou `dev` |
| Q-M6 | GitHub | ✅ Repositório **público**, branch padrão **`dev`**, gerenciado com a GitHub CLI (`gh`). A publicação no npm fica para depois |

## Resolvidas: o produto (sistema de MEMÓRIA)

### Estratégia e escopo

| ID | Pergunta | Resolução |
|---|---|---|
| Q-01 | Reuso do pi-hermes-memory | ✅ **Pacote novo reusando módulos** (MIT; manter os avisos de copyright de Chandra Teja e da Nous Research) |
| Q-02 | Formato no vault | ✅ **Nativo do Obsidian, com índice e um padrão estabelecido** (templates por tipo). Só **aprendizados e pontos importantes**, nunca um log de tudo |
| Q-03 | Já usa o pi-hermes-memory? | ✅ Não, então não há importação |
| Q-A1 | Hosts na v1 | ✅ **Só pi**, com núcleo agnóstico |
| Q-A2 | Tipos de memória | ✅ Duas camadas, detalhadas abaixo (aberta a complementos) |
| Q-N5 | O que conta como aprendizado | ✅ **Só o que muda o comportamento futuro:** preferência, padrão, decisão, lição, "não esquecer". Nunca estado temporário, narrativa de sessão nem o que já está no código ou no git |

**Camada GLOBAL** (sobre o usuário):
- tratamento e preferências;
- padrões de código que ele sempre usa;
- aprendizados globais.

**Camada PROJETO:**
- o que é e como funciona;
- padrões só do projeto;
- decisões;
- referências;
- tarefas em andamento;
- "não esquecer".

### Vaults, organização e acesso

| ID | Pergunta | Resolução |
|---|---|---|
| Q-B1 | Quantos vaults | ✅ **Um vault global + um vault por projeto** |
| Q-B1a | Vault global | ✅ **Dedicado** (ex.: `<raiz-de-vaults>/Agent-Global/`); os vaults pessoais do usuário ficam intocados |
| Q-N2 | Onde ficam os vaults de projeto | ✅ `<raiz-de-vaults>/Projetos/<projeto>/`, com raiz configurável (dentro ou fora do OneDrive) |
| Q-B8 | Como nasce o vault de projeto | ✅ **`/memory-init`**, oferecido na 1ª sessão numa pasta não cadastrada: cria o vault (estrutura padrão) ou escolhe um existente e grava o mapa na config |
| Q-G4 | Identidade do projeto | ✅ **Mapa manual** pasta → projeto (ver ⚠️) |
| Q-G7 | Global ou projeto | ✅ O agente classifica: fala do usuário → global; o resto → projeto; na dúvida, projeto. Padrão repetido em 2 ou mais projetos → propõe promoção |
| Q-B3/B4 | Notas que não são de memória | ✅ **Não** lê nem escreve fora dos vaults de memória |
| Q-B5/N4 | Templates e campos | ✅ **O agente propõe** os templates (`_padrao/templates/`) no `/memory-setup` e no `/memory-init`; o usuário aprova e edita no Obsidian. Campos base: `id`, `type`, `description`, `tags`, `project`, `created`, `modified`, `source`, `pinned` |
| Q-B6/N1 | Links | ✅ `[[wikilinks]]` **dentro** do vault; **entre vaults**, referência por id (ex.: `global:padrao-typescript`) resolvida pelo agente, com link `obsidian://` opcional |
| Q-B7/G6 | Idioma | ✅ **Inglês** (ver ⚠️) |
| Q-E2 | Renomear e mover | ✅ **O agente pode**, reescrevendo os links (ver ⚠️) |
| Q-G5 | Skills e regras fixas | ✅ **Nos vaults:** skills globais no global, as do projeto no projeto. Regras fixas viram "Não esquecer" (projeto) e preferências (global) |
| Q-T1 | Tarefas em andamento | ✅ Uma nota viva **"Em andamento"** por projeto, atualizada ao fim de cada sessão |

### Prompt, busca e dados

| ID | Pergunta | Resolução |
|---|---|---|
| Q-C1 | O que entra no prompt | ✅ Resumo **congelado no início da sessão**: global (perfil, padrões, índice) + projeto (visão curta, padrões, "Em andamento", **"Não esquecer" sempre**, índice). O resto vem via busca |
| Q-C2 | Orçamento | ✅ ~3k tokens, configurável. "Não esquecer" fica fora do orçamento (Q-N3) |
| Q-N3 | "Não esquecer" | ✅ **Sem limite** (ver ⚠️) |
| Q-C3 | Busca | ✅ **Texto + semântica já na v1**, com embeddings locais (ver ⚠️) |
| Q-C4 | Índice | ✅ **Local**, em `~/.pi/agent/<pacote>/index/`, reconstruível a partir dos vaults |
| Q-C5 | `session_search` | ✅ **Sim**, com índice local; nada vai para os vaults |
| Q-D1 | Pin no OneDrive | ✅ Sim, **com confirmação**, revalidado a cada início. **Só quando `sync.provider = onedrive`** (Q-N7) |
| Q-D2 | Quantos PCs gravam | ✅ Só este PC (a checagem de alteração antes de gravar continua) |
| Q-D3 | Exclusão | ✅ Nunca apagar: **mover para `archive/`** |
| Q-D4 | Backup | ✅ **Comando de export** (.zip) sempre; com OneDrive, também o histórico de versões dele. Sem OneDrive, o backup contínuo fica por conta do usuário (documentar no onboarding) |
| Q-D5 | Segredos | ✅ **Permitir** por padrão, configurável (ver ⚠️) |
| Q-D6 | Outro sync | ✅ No caso do usuário, só o OneDrive. No produto: no máximo um sincronizador por vault (avisar no onboarding) |
| Q-D7 | Plugins que reescrevem arquivos | ✅ **Vaults limpos:** o `/memory-init` cria o vault sem esses plugins |

### OneDrive (opcional)

| ID | Pergunta | Resolução |
|---|---|---|
| Q-N6 | O OneDrive é obrigatório? | ✅ **Não.** Os vaults podem ficar em qualquer pasta; o OneDrive é só para quem quiser. O núcleo não pode depender dele |
| Q-N7 | Como ligar as proteções de OneDrive | ✅ **Detecta e confirma.** Se o vault estiver dentro de uma pasta do OneDrive, o `/memory-setup` e o `/memory-init` avisam e, com confirmação, ligam as proteções (pin, arquivos só-na-nuvem, cópias de conflito). Fora dele, ficam desligadas. Config: `sync.provider = none \| onedrive` |

### Configuração, onboarding e automação

| ID | Pergunta | Resolução |
|---|---|---|
| Q-F1 | Onde fica a config | ✅ **Local** (`~/.pi/agent/<pacote>/config.json`: caminhos, mapa pasta → projeto → vault, orçamento) + **templates dentro de cada vault** |
| Q-F2 | Onboarding global | ✅ **`/memory-setup` interativo:** sugerido na 1ª sessão sem config, re-executável, com modo não interativo por variáveis de ambiente |
| Q-F3/F5/E3/E1 | Recursos da v1 | ✅ **Auto-detecção** de vaults e do OneDrive (só leitura) · **`/memory-doctor`** · **dashboard `.base`** · ❌ Obsidian CLI |
| Q-F4 | Opções expostas | ✅ Os 4 grupos: Locais · Conteúdo · Recuperação · Automação e segurança |
| Q-G1 | Quando salvar | ✅ **Automático e curado**, seguindo os templates. Gatilhos: correções e preferências, revisão periódica (~10 turnos), antes da compactação |
| Q-G3 | Consolidação | ✅ O agente **propõe em `inbox/`**, e o usuário aprova no Obsidian |
| Q-H5 | Telemetria do produto | ✅ **Logs + estatísticas locais**; nada sai da máquina |

### Engenharia

| ID | Pergunta | Resolução |
|---|---|---|
| Q-H1 | Node mínimo | ✅ **Node ≥ 24** |
| Q-H2 | Testes | ✅ **vitest**, testes de integração com vaults temporários, **CI no Windows** |
| Q-H3 | Distribuição | ✅ **npm** (keyword `pi-package`) + `pi install npm:<pacote>` |
| Q-H4 | Plataformas | ✅ **Windows primeiro**, núcleo portável para macOS e Linux depois |
| Q-H6 | Lint e formatação | ✅ **Biome** (versão exata no `package.json`), no `npm run lint` e no CI; sem ESLint nem Prettier. Estilo: sem ponto e vírgula, aspas duplas, linha de 120 colunas, imports ordenados em três grupos separados por linha em branco (Node, pacotes do npm, arquivos do projeto). Limites: arquivo com até 200 linhas e função com até 30, sem contar as em branco (nos testes, só o de arquivo). Proibidos: `any`, `unknown`, type assertion (`as const` pode) e index signature, inclusive `Record<string, T>`. Os dois últimos são barrados por plugins GritQL em `biome/`. Dado externo é validado com TypeBox. Comentário só quando explica um porquê |
| Q-H7 | Organização dos arquivos | ✅ **Todo módulo é uma pasta** (ex.: `scripts/release/plan/`), com a lógica e um arquivo por tipo de coisa: tipos em `types.ts`; valores do topo do módulo que não são função em `constants.ts`; schemas do TypeBox em `schemas.ts`; classes de erro em `errors.ts`; estilo (tema do pi e bibliotecas de cor) em `styles.ts`. Os testes espelham as pastas (`tests/release/plan/plan.test.ts`). As regras de tipo de arquivo valem no código, não nos testes. O Biome barra com plugins GritQL em `biome/` e com o `noRestrictedImports` (o construtor `Type` só nos schemas) |

### Publicação e versionamento

| ID | Pergunta | Resolução |
|---|---|---|
| Q-R1 | Nome no npm | ✅ `pi-obsidian-memory` (sem escopo) |
| Q-R2 | Licença | ✅ **MIT**. Os avisos de copyright do código reaproveitado do pi-hermes-memory entram quando esse código entrar |
| Q-R3 | Versionamento | ✅ **Automático pelos Conventional Commits, com o Git Flow intacto:** `npm run release` calcula a versão e roda `git flow release`; a tag publica no npm via Trusted Publishing ([ADR 0001](decisions/0001-versionamento-automatico-e-publicacao-npm.md)) |
| Q-R4 | Atribuição de IA nos commits | ✅ **Proibida:** nenhum `Co-Authored-By` nem menção a IA em commits, merges, tags ou PRs |
| Q-R5 | CI | ✅ **`ci.yml` no Windows**, a cada push nas branches do Git Flow e em cada PR: Biome, tipos, testes e `openspec validate --all --strict` |
| Q-R6 | Quem pode publicar no npm | ✅ **Só o GitHub Actions** (Trusted Publishing do `release.yml`); publicação por token bloqueada (`mfa=publish`) |

## Superadas

| Item | Motivo |
|---|---|
| Q-A4 (importar do pi-hermes-memory) | ⏭️ O usuário não usa o original |
| Q-B2 (nome da pasta de memória dentro de um vault) | ⏭️ Os vaults são dedicados |
| Q-G2 (salvar antes da compactação) | ✅ Incluído no Q-G1 |
| Daily log por dispositivo (estudo) | ⏭️ Descartado: nada de log bruto (Q-02); só um PC (Q-D2) |
| Memória numa pasta do vault pessoal do usuário (estudo) | ⏭️ Substituída por vaults dedicados |

## Pontos a checar na prática (spikes da F0, com autorização)

Os pontos P-1 a P-10 estão em [research/06-perguntas-abertas.md § Pontos a checar](research/06-perguntas-abertas.md). P-1 a P-4 só valem no modo OneDrive:
- pin do OneDrive e histórico de versões;
- detecção de placeholder e frequência de `EPERM`;
- formato do `obsidian.json` e merge do Obsidian;
- pontos de corte do pi-hermes-memory;
- prompt templates no pi e `ctx.reload()`.

Pontos novos:

| # | Ponto | Por que importa |
|---|---|---|
| P-11 | Esta máquina tem **duas instalações do pi**, ambas na v0.87.1: o `pi.exe` do WinGet e o pacote npm no Node 24 do fnm. Com o fnm ativo (PowerShell 7 e 5.1), vale a do npm. Confirmar em qual runtime a extensão roda e se `node:sqlite` está disponível nas duas | Q-H1, Q-C4 |
| P-12 | Custo e tempo dos embeddings locais em inglês no Windows (download, RAM, indexação inicial) | Q-C3 |
