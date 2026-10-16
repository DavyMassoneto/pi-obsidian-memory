# Decision-model thresholds (Laya)

Measured 2026-10-16 against a live `laya-serve` 0.4.8 (checkpoint `multilingual`, revision `7b928d82`, CPU), through our
real client code (`decideMemory` for the gate, `scoreCandidates` for relevance). Reproduce with `npm run test:model`
(`tests/services/decision-model/thresholds.model.test.ts`; skips with a reason when no server answers at the configured
endpoint). The scores are deterministic: two runs gave identical numbers.

## Verdict

- **No Laya cutoff is shipped as a default.** The gate is at chance and relevance has too few positives (10 in the
  holdout) to support one. The user sets `gateThreshold` and `relevanceThreshold` explicitly; the numbers below only
  inform that choice.
- **Gate ("does this message need stored memory?"): Laya is at chance.** All-items AUC is 0.50 (plain) and 0.59 (labels
  A/B), with 95% intervals 0.35-0.65 and 0.45-0.73. Both include 0.5. No cutoff holds up on the
  holdout. **No Laya default for the gate is supported.** Until a larger measurement says otherwise, the Laya gate
  should not be trusted to skip retrieval.
- **Relevance ("does this note help answer the message?"): there is a weak signal.** All-items AUC is 0.76 (plain,
  interval 0.62-0.90) and 0.68 (labels, interval 0.52-0.83). Plain `noul` separates better than `noul` with A/B
  labels in this set; the intervals overlap, so this is not conclusive, but labels did not help.
- **Proposal, low confidence (not a default):** relevance cutoff 0.2 for plain `noul` (best F1 on the fit half; holdout
  precision 73%, recall 80% with only 10 positives). Do not apply it as a default without a larger set. Jev keeps the
  documented 0.5 starting value.
- **Labels, as shipped (decided from this measurement):** the Laya gate question is sent with the A/B labels
  (`labels: {"true":"A","false":"B"}`, the README's first fix for issue #156) because they scored slightly higher
  there (AUC 0.59 against 0.50, both inside the chance interval). The Laya relevance question is sent without labels
  because plain `noul` separated better (AUC 0.76 against 0.68). Jev never receives labels. Repeat the measurement
  on a larger set before treating either choice as settled.

## Method

- Guidance followed: TypeSafe "Simple memory system" cookbook, section "How should I choose the threshold?" (label
  request-and-answer pairs, find the probability that best separates the groups, check it on pairs you did not use to
  pick it; https://docs.typesafe.ai/cookbooks/basic_memory.md), "The memory threshold of 0.5 is a starting point. You
  should evaluate it against your own examples"; the re-ranking cookbook (one `noul` per query-candidate pair, 40
  queries, the first 20 rows held out from evaluation; https://docs.typesafe.ai/cookbooks/rerank_typesafe.md); and the
  Noul page on setting the threshold from the cost of each mistake (https://docs.typesafe.ai/primitives/noul.md).
- Fixtures are synthetic and written by hand, half Portuguese and half English (the configured model is multilingual):
  `tests/helpers/gate-fixtures.ts` (60 messages, 30 need memory about the user or project, 30 are self-contained
  questions) and `tests/helpers/relevance-fixtures.ts` (48 message-note pairs: 20 relevant, 20 unrelated notes, 8 hard
  negatives about the same topic that do not answer the message).
- Fit/holdout: within each class, items alternate fit, holdout, fit, holdout, so each half keeps the class balance (gate
  30/30, relevance 24 fit with 10 positives and 24 holdout with 10 positives). The cutoff is chosen on the fit half
  (best F1 over 0.05-0.95) and reported on the holdout half. Cutoffs were not tuned on the holdout.
- Variants: "plain" is our request without the `labels` field; "labels A/B" adds `labels: {"true":"A","false":"B"}`
  inside the question. The test runs the request as shipped and then with the labels choice flipped on the wire.
  Same prompts, same state order (short fields first).
- Metrics: AUC is the probability that a random positive scores above a random negative (0.5 is chance); the interval is
  Hanley-McNeil. Precision and recall are per cutoff on the holdout. With 10-15 positives per half, every holdout number
  carries wide uncertainty.

## Gate (60 messages, holdout 15 positive and 15 negative)

| variant | all-items AUC | fit AUC | holdout AUC (95%) | mean score on holdout, pos / neg |
| --- | ---: | ---: | ---: | ---: |
| plain noul | 0.501 | 0.444 | 0.551 (0.34-0.76) | 0.376 / 0.312 |
| noul with labels A/B | 0.589 | 0.653 | 0.476 (0.27-0.69) | 0.414 / 0.393 |

Holdout precision / recall per cutoff (plain, then labels):

| cutoff | plain | labels A/B |
| ---: | ---: | ---: |
| 0.1 | 50% / 87% | 50% / 100% |
| 0.3 | 50% / 53% | 45% / 67% |
| 0.5 | 71% / 33% | 67% / 27% |
| 0.7 | 100% / 7% | 100% / 7% |
| 0.9 | 100% / 7% | - / 0% |

At every cutoff the precision is about the class base rate (50%) until the cutoff is so high that recall is 7% or less.
That is chance behaviour, not a usable gate.

## Relevance (48 pairs, holdout 10 positive and 14 negative)

| variant | all-items AUC | fit AUC | holdout AUC (95%) | mean score on holdout, pos / neg |
| --- | ---: | ---: | ---: | ---: |
| plain noul | 0.762 | 0.721 | 0.807 (0.62-0.99) | 0.459 / 0.137 |
| noul with labels A/B | 0.676 | 0.629 | 0.746 (0.54-0.96) | 0.721 / 0.525 |

Holdout precision / recall per cutoff:

| cutoff | plain | labels A/B |
| ---: | ---: | ---: |
| 0.1 | 67% / 80% | 42% / 100% |
| 0.2 | 73% / 80% | 45% / 100% |
| 0.3 | 70% / 70% | 43% / 90% |
| 0.4 | 75% / 60% | 47% / 90% |
| 0.5 | 86% / 60% | 53% / 90% |
| 0.6 | 75% / 30% | 58% / 70% |
| 0.7 | 100% / 30% | 64% / 70% |
| 0.8 | - / 0% | 63% / 50% |
| 0.9 | - / 0% | 50% / 10% |

With labels the whole score distribution shifts up (negatives average 0.53), so the labelled variant needs a high cutoff
for the same precision and loses recall there. Plain `noul` ranks relevant notes higher and keeps negatives low.

## Limits of this measurement

- 60 and 48 synthetic examples, one run; the holdout halves are 30 and 24 items. Intervals are wide.
- Only the `multilingual` checkpoint on CPU with `max_len` 8192 and `head_max_len` 192. The `english` and
  `typed-decisions` checkpoints were loaded by the server but not measured.
- The instruction wording is ours (`src/services/decision-model/prompts.ts`); a different wording can move the numbers.
- Messages are single turns. Real traffic (long messages, mixed languages, notes that partly overlap) may differ; the
  cookbook's advice is to repeat the measurement on your own traffic before fixing a cutoff.
