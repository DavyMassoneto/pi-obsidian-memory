---
description: Entrevista de descoberta antes de qualquer spec ou código
---
Tema: $ARGUMENTS
1. ANTES de perguntar, leia docs/STATE.md, docs/OPEN-QUESTIONS.md, os docs relevantes e o código.
   Não pergunte o que dá para descobrir lendo.
2. UMA pergunta por mensagem, com 2–4 opções, prós e contras curtos e a sua recomendação (★). Aceite resposta livre.
   No Claude Code, use a ferramenta AskUserQuestion.
3. Ordem: bloqueantes (🔴) > caras de reverter > o resto. Pule o óbvio; aprofunde onde eu hesitar.
4. Depois de cada resposta, atualize a linha em docs/OPEN-QUESTIONS.md (status + resolução).
   Decisão arquitetural → rascunho de ADR em docs/decisions/.
5. Não confunda o sistema de SPEC (docs deste projeto) com o sistema de MEMÓRIA (o produto, que grava nos vaults).
6. Quando acabar (ou quando eu disser "chega"): resuma as decisões, liste o que continua 🔴 e proponha
   o próximo artefato. NÃO escreva código.
