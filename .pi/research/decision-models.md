# Decision models: Laya and Jev (research, 2026 sources)

Legend: [V] verified from a cited source; [U] unverified.

## 1. What our code assumes
- Defaults: provider laya, endpoint http://127.0.0.1:8000/v1/systemone, model "multilingual", maxTokens 8192, headMaxTokens 192 (src/services/decision-model/constants.ts:1-7; docs/config.md:27-33).
- Jev default model id "jev-latest" (constants.ts:9); called via pi `classifier.classify({model:{provider:"typesafe",id}, context, options})` (jev.ts:9-13).
- Laya called with fetch POST {model,state,questions(bool->noul),max_len,head_max_len}, optional Bearer (laya.ts:12-25).
- ROADMAP milestone 6 first bullet: docs/ROADMAP.md:387-389.

## 2. Jev (TypeSafe System One) [V]
- Jev = TypeSafe's flagship System One model. https://docs.typesafe.ai/models.md
- Endpoint `POST https://api.typesafe.ai/v1/systemone`; body {model,state,questions}. https://docs.typesafe.ai/api.md ; pi catalog baseUrl `https://api.typesafe.ai/v1/` (node_modules/@earendil-works/pi-ai/dist/providers/data/typesafe.json:1).
- Model ids: `jev-1.14.0`, `jev-1.13.0`; aliases `jev-latest` -> jev-1.13.0, `jev-preview` -> jev-1.14.0. https://docs.typesafe.ai/models.md
- Pi catalog has only one classifier: id `jev-latest`, name Jev, api typesafe-system-one, contextWindow 64000, cost all 0 (typesafe.json:1). Cost 0 in pi catalog != real price.
- Auth: `Authorization: Bearer $TYPESAFE_API_KEY` (docs quickstart; pi providers/typesafe.js:10 `envApiKeyAuth(..., ["TYPESAFE_API_KEY"])`; dist/env-api-keys.js:91).
- Pricing: input $42/Btok = $0.042/Mtok, output free. Context 64k per request / 32k per question (262k with header `TypeSafe-Danger-Zone-Long-Context: true`). Rate limits per org, 429 on excess. https://docs.typesafe.ai/models.md
- Noul request: {"type":"noul","instructions":..., optional "criteria":{"true":..,"false":..}}; answer {"type":"noul","noul":0.95}. https://docs.typesafe.ai/primitives/noul.md
- Response: {model, answers, usage:{input_tokens,output_tokens}}; example response model is "jev-1.13.0" for request "jev-latest". https://docs.typesafe.ai/api.md
- Docs say each response's `model` is the versioned id that answered, for logging. https://docs.typesafe.ai/models.md
- Pi: yes, `models.classify()` -> provider.classify (pi-ai/dist/models.js:503-511). Transport typesafe-system-one posts to `<baseUrl>/systemone` with payload {model:id, state, questions} and maps bool->noul (dist/api/typesafe-system-one.js:6-18; system-one-shared.js:109-117,137,148). Result `{answers:{id:{type:"bool",probability}}, usage:{input,output,...}, stopReason, model}`; errors/abort do not throw, they set stopReason (system-one-shared.js:177-181). Missing key -> stopReason "error" (system-one-shared.js:134). `options.maxRetries` default 2 (line 164). pi-coding-agent docs mention it: docs/codemode.md:86-92.
- pi-ai package version 1.0.1 (node_modules/@earendil-works/pi-ai/package.json:3).

## 3. Laya (convaiinnovations) [V]
- Non-autoregressive System 1 decision model; takes state + typed questions, returns typed answers in one forward pass, no text generation. https://huggingface.co/convaiinnovations/laya-multilingual
- Checkpoints (HF README table; API https://huggingface.co/api/models?author=convaiinnovations):
  - convaiinnovations/laya: ModernBERT-large, 421M params, ctx 512, English.
  - convaiinnovations/laya-multilingual: mmBERT-base, 322M params (F16 ~322M; repo ~678 MB used storage), ctx 1024 (up to 8192), 100+ languages, ~2x faster. https://huggingface.co/api/models/convaiinnovations/laya-multilingual
  - convaiinnovations/laya-typed-decisions: ModernBERT-large, 421M, ctx 1024 (~842 MB storage). https://huggingface.co/api/models/convaiinnovations/laya-typed-decisions
- License: apache-2.0 on all three (HF cardData); PyPI `laya` 0.4.8 license Apache-2.0, Python >=3.10. https://pypi.org/pypi/laya/json
- Not gated (`"gated":false`, HF API). Weights are auto-downloaded from the Hub by `laya.load()` / Router [inferred from README quickstart, download size not measured].
- Official package/server: `pip install "laya[serve]"` then `laya-serve` (fastapi>=0.110, uvicorn>=0.27 extras; torch>=2, transformers>=4.48). https://huggingface.co/convaiinnovations/laya (section "Self-hosting: Jev-compatible HTTP server"); https://pypi.org/pypi/laya/json ; source https://github.com/NandhaKishorM/laya/blob/main/laya/serve.py
- Defaults: bind `0.0.0.0:8000`, NO auth unless LAYA_API_KEY set (serve.py:23-24,39; HF README). Env: LAYA_HOST, LAYA_PORT, LAYA_DEVICE, LAYA_PRELOAD (default 1), LAYA_MODELS, LAYA_MAX_TOKEN_BUDGET (8192), LAYA_JEV_STRICT, LAYA_API_KEY (serve.py:23-56).
- Local-run command for our default (127.0.0.1:8000): `pip install "laya[serve]"; LAYA_HOST=127.0.0.1 LAYA_PORT=8000 USE_TF=0 laya-serve` [composed from serve.py env table; not executed here]. `USE_TF=0` advised if load hangs (HF README).
- Hardware: GPU optional; LAYA_DEVICE preference, LAYA_THREADS for CPU (serve.py:25-29). Disk/RAM/CPU latency not published in what I read [U]. README claims 4000-token input ~1.7 s on an Apple GPU.
- Request fields honoured: model, max_len, head_max_len, task, lang, lang_guess, min_confidence (serve.py:161). model accepts english/multilingual/typed-decisions + aliases; unknown path/hub id -> 422. https://github.com/NandhaKishorM/laya/blob/main/README.md (Self-Hosting section)
- Budgets: multilingual default ctx 1024, head_max_len 256; encoder up to 8192; "pass max_len=8192 for long documents"; results beyond ~4000 tokens "vary". HF laya-multilingual README.
- Known limit: >20 choice options degrade; irrelevant to our single bool question.
- Noul caveat: "`noul` can under-report true" on clearly positive inputs (HF laya-multilingual README, "Honest limits"). Calibration vs Jev differs; thresholds not transferable (GitHub README line ~791).

## 4. Field-by-field: our Laya code vs server
Match [V]:
- Path /v1/systemone, POST JSON; Bearer only enforced if LAYA_API_KEY (laya.ts:12-13 vs serve.py:39).
- Request {state, questions{id:{type:"noul",instructions,criteria{true,false}}}} matches Jev/Laya example (HF README curl).
- Response `answers.<id>.noul`, `usage.input_tokens/output_tokens`, `usage.truncated`, `state_tokens_dropped`, `truncated_questions`, `options`, root `routing{model,repo,reason,detection,workflow}`: field names exist in serve/router/agent sources (router.py:1228 RouteDecision(model,repo,reason,detection,workflow); agent.py:1542-1561; serve.py:1400).
- Canonical names for alias map in laya-response.ts:29-45 equal router.py `_ALIASES` / STANDALONE_MODELS (router.py:59-90). 
- max_len cap 8192 = LAYA_MAX_TOKEN_BUDGET default (serve.py:49).
Mismatch / risk:
1. routing.reason is built from the RAW requested string: `"explicit model=%r" % model` (router.py:1228) while routing.model is the canonical key. laya-response.ts:62 requires reason == `explicit model='<canonical>'`. With model "multilingual" (the only allowed value, config.md:68-69) it works; with an alias such as "laya" the reason is "explicit model='laya'" and we would reject [V by reading code; not run].
2. `LAYA_JEV_STRICT=1` removes root `routing` and per-answer extras (serve.py:51-54,205-240) -> our code returns invalid-response (laya-response.ts:62). Must not be set.
3. Our zod-like schema is `additionalProperties:false` on usage/answers/routing (schemas.ts:19,49,60,72,76); any new field in a future laya release (e.g. `x_jev_confidence`, `x_tournament` on answers, serve.py:13,337) will make every response invalid. Fixed at 0.4.8 only.
4. Default bind is 0.0.0.0 with no auth; our loopback-only check (preflight.ts:18) does not make the server loopback. User must set LAYA_HOST=127.0.0.1.
5. head_max_len 192 is the English default; multilingual default is 256 (HF README). 192 is allowed by server but is our own choice [U whether it affects accuracy]. maxTokens 8192 differs from default 1024; slower, accuracy "varies" past ~4000 tokens.
6. We reject low_confidence / abstention answers (laya-response.ts:75); fields exist in serve extras but when emitted is not verified [U: abstention only when min_confidence se

## 5. Jev mismatch found
- jev.ts:18 requires `result.model === context.model`; default is "jev-latest". The API returns the versioned id ("jev-1.13.0"; https://docs.typesafe.ai/api.md example, https://docs.typesafe.ai/models.md aliases). So the default Jev config would always yield `invalid-response` [V from docs; not run live].
- Pi catalog lists only `jev-latest` (typesafe.json:1). classify uses only model.id in the payload (typesafe-system-one.js:10), so pinning `jev-1.13.0` likely works [U, not run].
- Pi catalog cost is 0, so pi's usage cost differs from the real $0.042/Mtok.

## 6. Unknown / not checked
- No live Jev call (needs TYPESAFE_API_KEY); did not install or run laya-serve (large torch download).
- Laya CPU latency, RAM, first-download size; Windows support of laya-serve.
- When `abstention`/`low_confidence` are emitted (serve.py/agent.py).
- Not read: docs.typesafe.ai /models "Data handling" section (cut off), /sdk, terms/retention; nandhakishorm.github.io/laya docs; docs/http-api.md in the repo; pi docs/models.md "Use classifier models".
