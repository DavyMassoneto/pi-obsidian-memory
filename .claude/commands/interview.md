---
description: Discovery interview before any spec or code
---
Topic: $ARGUMENTS
1. BEFORE asking, read docs/STATE.md, docs/OPEN-QUESTIONS.md, the relevant docs and the code.
   Do not ask what you can find out by reading.
2. ONE question per message, with 2–4 options, short pros and cons and your recommendation (★). Accept a free answer.
   In Claude Code, use the AskUserQuestion tool. Ask in Brazilian Portuguese; record the answers in English.
3. Order: blocking (🔴) > expensive to reverse > the rest. Skip the obvious; dig deeper where I hesitate.
4. After each answer, update the row in docs/OPEN-QUESTIONS.md (status + resolution).
   Architectural decision → draft ADR in docs/decisions/.
5. Do not confuse the SPEC system (this project's docs) with the MEMORY system (the product, which writes to the vaults).
6. When done (or when I say "enough"): summarize the decisions, list what is still 🔴 and propose
   the next artifact. Do NOT write code.
