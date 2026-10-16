# Laya and Jev: what they are and how a memory system should use them

Legend: [V] read in a primary source named on the line; [I] inferred by me; [U] not found / not checked.
Fetched 2026 (docs.typesafe.ai pages are dated up to 2026-10-14; Laya PyPI 0.4.8; HF last modified 2026-10-03).

## Conclusion

- Both are "System One" decision models: they are NOT generators. Input: a `state` (string/JSON) plus named, typed
  questions. Output: one typed answer per question with probabilities. No text, no search, no retrieval.
- Jev = TypeSafe's closed, hosted, paid model. Laya = a separate, open-source (Apache-2.0), third-party reimplementation
  of the same wire protocol, run locally. They are not the same company or weights. [V]
- Neither "searches". Relevance of a candidate = ask a Noul (yes/no probability) per candidate, or a Choice over
  candidate ids; your code sorts/thresholds. [V for Jev cookbooks; I for Laya]
- Laya checkpoints ship uncalibrated and near chance zero-shot on some tasks: validate before trusting thresholds. [V]

## 1. What kind of model

Jev (TypeSafe):
- "Jev is TypeSafe's flagship model and the first System One model... returns typed decisions and probabilities rather
  than generated text." https://docs.typesafe.ai/concepts/system-one.md
- "System One models do not write replies, produce code, or generate explanations of their reasoning." same page.
- "It does not generate text, write code, or hold a conversation."
  https://docs.typesafe.ai/introduction/coding-agents.md
- Trained with RLCD (RL for calibrated decisions); "The model does not generate text. It returns decisions and
  probabilities." https://docs.typesafe.ai/introduction/machine-learning-primer.md
- Not fine-tuned per customer; not trained on customer requests. https://docs.typesafe.ai/models.md ("Customizing Jev",
  "Data handling")
- Text input only; English best, other languages "not equally well". https://docs.typesafe.ai/models.md
- Question types (primitives): https://docs.typesafe.ai/api.md
  - `noul`: yes/no -> `{"type":"noul","noul":0.95}` (P(yes); no separate confidence; threshold it yourself)
    https://docs.typesafe.ai/primitives/noul.md ("There is no separate `confidence` value for a Noul")
  - `choice`: one of up to 255 options -> `{choice, probabilities{option:p} (sum 1), confidence}`
  - `score`: ordered levels -> `{score (prob-weighted, can fall between levels), legend, probabilities, confidence}`
  - `box`: image box (listed in https://docs.typesafe.ai/llms.txt; text-only models page says images unsupported "yet"
    at system-one.md; not relevant to us)

Laya (convaiinnovations / Nandakishor M, GitHub NandhaKishorM/laya):
- "Multilingual, non-autoregressive System 1 decision engine. Typed decisions over 100+ languages in a single forward
  pass... No text generation." https://github.com/NandhaKishorM/laya/blob/main/README.md (lines 8, 132)
- Encoder models (not LLMs): `laya` ModernBERT-large 421M ctx 512 (English); `laya-multilingual` mmBERT-base 322M ctx
  1024
  (up to 8192 with `max_len=8192`); `laya-typed-decisions` ModernBERT-large 421M ctx 1024. Same README line 134-140;
  https://huggingface.co/convaiinnovations/laya
- Same three primitives `choice`/`score`/`noul`. Same README line 132.
- Honest limits stated by the author (https://huggingface.co/convaiinnovations/laya, "Honest Limits"):
  - base checkpoints "near chance on typed-decisions zero-shot... a fast base to specialise, not a zero-shot decision
    engine"; "Ships over-confident" (mean ECE 0.314 -> 0.106 after refitting temperatures on your own data,
    multilingual).
  - `noul` "can follow its option labels instead of the state" (issue #156); suggested workaround: a 2-option `choice`
    with neutral keys A/B. Also on the multilingual card ("Limits": `noul` can under-report true, P~0.5 on positive).
  - choice questions: keep under ~20 options (shared 256-token head budget); `score` is the weakest primitive.
  - Routing to the English vs multilingual checkpoint is automatic by script/language in `Router`.

## 2. Can they generate / search / rank / score relevance?

- Generate text: Jev no (system-one.md); Laya no (README:132).
- Search an index / retrieve: neither; you send the candidates in `state` or in a question. [V Jev; I Laya]
- Rank N candidates: Jev yes, by your code: one Noul per candidate then sort (rerank cookbook), or one Choice whose
  options are candidate ids (semantic_find: 218 line ids in one request). Laya: same question types [I], but the
  option budget makes many-option choice weak (~20) [V].
- Score relevance: Jev yes (Noul P(yes) or Score level). Laya yes, same types, but poorly calibrated out of the box. [V]
- Say "none relevant": add a `none_suitable` Choice option (basic_memory) or a Noul `exists` check (semantic_find).
  Laya: same [I].

- Re-ranking evidence (Jev): BM25 shortlist of 30 -> one Noul per (query, candidate) pair, sorted by the number; top-1
  5% -> 18%, top-10 38% -> 62% on 40 CLERC legal queries. https://docs.typesafe.ai/cookbooks/rerank_typesafe.md
  (1,200 calls, "run concurrently"; one request per pair).
- Choice probabilities always sum to 1, so "a line ranks first even when none answers" -> pair with a Noul `exists`.
  https://docs.typesafe.ai/cookbooks/semantic_find.md
- Many questions in one request are allowed ("no separate limit on the number of questions"), evaluated in parallel
  against one ingested `state`. https://docs.typesafe.ai/models.md ("Context length"); /patterns/fan-out.md

## 3. API, pricing, licence, local vs remote

Jev (remote only; no weights offered in anything I read [U: no explicit "no self-host" statement found]):
- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <API_KEY>`, JSON UTF-8, body <= 32 MiB,
  gzip/zstd accepted. https://docs.typesafe.ai/api.md
- Request: `state` (string|object|array, required), `model` (required), `questions` (map id -> question; the id is not
  sent to the model). Question: `{type, instructions (string|object|array), criteria?}`; noul criteria `{true,false}`;
  choice criteria map option -> description|object|null; score criteria levels. api.md
- Response: `{model, answers{id: answer}, usage{input_tokens, output_tokens}}`; `model` is the versioned id that
  answered (example request `jev-latest` -> response `jev-1.13.0`). api.md; models.md ("Aliases")
- Models: `jev-1.14.0` (from 2026-10-14), `jev-1.13.0`; `jev-latest` -> 1.13.0, `jev-preview` -> 1.14.0. models.md
- Price: $0.042 per Mtok input ($42/Btok), output free. Context 64k per request / 32k per question; 262k with header
  `TypeSafe-Danger-Zone-Long-Context: true` (slower, less accurate). Rate limits per org; 429 / 529 -> retry. models.md,
  api.md
- Errors 400/401/413/415/422/429/529. api.md
- Licence/terms: hosted service under Master Customer Agreement; not trained on customer data; ZDR for enterprise only.
  https://docs.typesafe.ai/legal.md (MCA/DPA/Privacy pages themselves not read [U]). Jev weights: closed [I].
- Client SDKs: Python and JS (`@typesafe-ai/sdk`, MIT per installed package.json:license, version 0.6.0). The JS SDK
  does `POST "/v1/systemone"` with `Authorization: Bearer` (installed dist/index.mjs.map).
  https://docs.typesafe.ai/sdk.md

Laya (local, you run it):
- `pip install laya` (Apache-2.0, Python >=3.10, https://pypi.org/pypi/laya/json); weights Apache-2.0 on the Hub,
  auto-downloaded on first use. Free. https://huggingface.co/convaiinnovations/laya
- Library: `Router().predict(state, questions, model=..., max_len=..., head_max_len=...)`.
- HTTP: `pip install "laya[serve]"`; `laya-serve` -> same `POST /v1/systemone` as Jev, plus `POST /v1/systemone/batch`
  (<= 64 states); binds `0.0.0.0:8000`; `LAYA_API_KEY` enables Bearer auth; env LAYA_HOST/PORT/DEVICE/PRELOAD/...
  README "Self-Hosting: HTTP Server (Jev-compatible)", lines 720-790. Server request extras: `task`, `lang`,
  `lang_guess`, `min_confidence`, `max_len`, `head_max_len`.
- Speed (author's measurement on a T4): 33 ms single question, ~7 ms/question batched; a 4,000-token input takes about
  1.7 s on an Apple GPU. README:132, 1470-1480. CPU latency/RAM: not published in what I read [U].
- Differences from Jev when porting (README 787-791): option budget `head_max_len` (192 English / 256 others) instead of
  255 options, server cap 100 choice options; `confidence` = 1 - normalised entropy, NOT Jev's formula, so Jev
  thresholds do not transfer; `answer_confidence` is the probability of the reported answer.

## 4. Relation between Laya and Jev

- Different organisations: Jev is TypeSafe's (cofounder Diogo Almeida named at machine-learning-primer.md). Laya is by
  convaiinnovations / NandhaKishorM; the README benchmarks against Jev with "Jev figures are third-party published,
  never measured here (no TypeSafe API access)" (README ~1483). No affiliation statement found [U].
- Laya copies the *interface*: "schema-identical to what Jev returns", "an existing Jev client ... just needs its
  `baseUrl` repointed" (README 722-727). Laya also uses the "System 1" and RLCD naming.
- Jev leads on >20-option choice (Banking77 0.870 vs 0.425) and soft-distribution calibration; Laya (fine-tuned
  typed-decisions) leads on argmax 0.766 vs 0.727. README 1487-1530. These are the Laya author's own numbers, not
  independently verified.
- "Jev" in `jev_run` is the same TypeSafe Jev (section 5).

## 5. Local pi-jev-browser (jev_run)

- Package: `C:\Users\Administrator\.pi\agent\npm\node_modules\pi-jev-browser` v0.3.0, Apache-2.0, third-party
  (repo laihenyi/pi-Jev-browser), depends on `@typesafe-ai/sdk ^0.6.0` (package.json). Browser/desktop agent: Jev picks
  each action from a structured observation.
- Credentials: `src/credentials.ts:4-5` default base `https://api.typesafe.ai`, default model `jev-latest`; key from
  `TYPESAFE_API_KEY` or `typesafe.apiKey` in `~/.pi/agent/pi-jev-browser.config.json` (credentials.ts:29-32, 38-42).
  (A real key is stored in that file; not reproduced here.)
- Client: `src/policy.ts:407-419` `new TypeSafeClient({apiKey, baseURL, defaultModel, timeout: 10_000, retry:
  {maxRetries: 2, maxRetryAfterMs: 5000}})`.
- Call: `client.systemOne({state: JSON.stringify({page: observation, recentActions: last 10}), questions})`
  (policy.ts:492-501); one `choice` question `action` whose `criteria` options are `WAIT`, `BLOCKED`, `REVIEW`, `DONE`,
  `SCROLL_UP/DOWN` and one option per page element `"<operation>:<id>"` with an object description (policy.ts:37-98);
  `instructions` is an object `{goal, rules, task}`.
- Response use: `answer.type === "choice"` and `answer.choice` must be one of the offered keys, else error "Jev returned
  an unoffered action" (policy.ts:503-508); it reads `answer.probabilities[choice]` and `answer.confidence`
  (policy.ts:513-518). So Jev returns the chosen option, per-option probabilities and a confidence.
- Free text is NOT generated by Jev: candidates are extracted mechanically and Jev picks one or `NONE`
  (policy.ts:163-168, 521-545); an optional separate pi model writes text.

## 6. Earlier note `.pi/research/decision-models.md`: right and wrong

Right (re-confirmed above): Jev endpoint/body/price/aliases/versioned `model` in response ($0.042/Mtok, 64k/32k,
jev-latest -> jev-1.13.0); Laya is non-autoregressive, Apache-2.0, three checkpoints with the stated sizes and contexts,
`laya-serve` Jev-compatible, 0.0.0.0 default bind without auth, >20 options degrade, `noul` can under-report true, Jev
and Laya confidence formulas differ.

Wrong or outdated:
- Section 5 ("default Jev config would always yield invalid-response" because `result.model === context.model`) is
  outdated: current `src/services/decision-model/jev.ts:11-25` accepts a reported versioned id when the requested one is
  an alias with the same family and a numeric tail (`modelVersionPattern`, constants.ts:13). [V by reading; not run]
- Section 4 item 1 (Laya `routing.reason` alias mismatch): router.py:1228 still builds
  `reason="explicit model=%r" % model`, but `laya-response.ts:50-51` now accepts both requested and canonical name, so
  that risk is handled in current code. [V by reading]
- Missing from it: Laya ships over-confident/uncalibrated and is "near chance" zero-shot on typed decisions; the `noul`
  label-bias issue #156 with the A/B `choice` workaround; Laya `confidence` is not Jev's. Also missing: Jev's own
  cookbooks for memory, re-ranking and RAG passage filtering (section 7), and that neither model can search.

## 7. How a memory system should use them (per the docs)

"Does this message need memory?" (gate):
- Jev's "Simple memory system" cookbook uses one Noul "gate" per request and thresholds it in code: P(yes) >= 0.5 saves
  a memory; "The memory threshold of 0.5 is a starting point. You should evaluate it against your own examples."
  https://docs.typesafe.ai/cookbooks/basic_memory.md. The instruction is specific, with explicit `criteria.true` and
  `criteria.false`, and structured state keys (`request`, `jev_answered`). That cookbook gates *saving*. For *recall*
  the same shape applies: a Noul like "does answering `message` need facts from earlier conversations or stored
  notes?" with true/false criteria [I, my adaptation].
- Threshold guidance: 0.5 when errors are symmetric, raise it when a false yes is costly, lower it when a miss is
  costly, send the middle band to a fallback. https://docs.typesafe.ai/primitives/noul.md. Extra checks can be extra
  Nouls in the same request. https://docs.typesafe.ai/patterns/fan-out.md
- Put the message in `state`, the question in `instructions`, the meaning of yes/no in `criteria`. api.md

"Which of these candidate notes are relevant?":
- Re-ranking cookbook: cheap first stage (keyword/embedding) -> shortlist -> one Noul per (message, note) pair
  (`state={"query_excerpt":..., "candidate_passage":...}`), sort by `noul`, keep top-k or those above a threshold.
  https://docs.typesafe.ai/cookbooks/rerank_typesafe.md. Reported gain is modest (top-1 5% -> 18%, top-10 38% -> 62%).
- RAG-passage cookbook: several Nouls per passage (relevant? usable evidence? contradicts premise? instructs the model?)
  with thresholds in code (relevant_min 0.45, evidence_min 0.55, injection_max 0.70). Notes can carry prompt injection,
  so an "instructs the model" Noul is worth having.
  https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md
- One-request alternative: a Choice with note ids as options plus an `exists` Noul; Choice sums to 1 and always ranks
  something first. https://docs.typesafe.ai/cookbooks/semantic_find.md. With Laya keep options <= ~20 [V limit].
- Laya: same questions, but calibrate thresholds on your own labelled data first, cross-check `noul` wording against an
  A/B `choice` equivalent, and never reuse Jev thresholds. [V limits in section 1]

## 8. Unknown / not checked

- Live calls to Jev or a running `laya-serve` (no paid call made, nothing installed).
- Not read: typesafe.ai home/manifesto (Framer page gave no text), MCA/DPA/Privacy text, Jev model-jaggedness pages,
  rerank cookbook latency/cost sections, https://nandhakishorm.github.io/laya/ docs, Laya GitHub issues #156/#394,
  papers (none located).
- Whether TypeSafe publishes self-hostable weights (nothing found in the docs read).
