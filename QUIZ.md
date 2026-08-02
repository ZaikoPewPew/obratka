# Квиз после ревью — пул вопросов и PDF-отчёт

Источник правды по **опросу** (`/quiz`) и **трактовке ответов** в листе/PDF.  
UI-шаги: [`src/components/review-panel/README.md`](src/components/review-panel/README.md).  
Шкалы: [`src/components/scale-slider/README.md`](src/components/scale-slider/README.md).  
Движок текстов: [`src/utils/reviewReport.js`](src/utils/reviewReport.js).  
Строки: [`content/locales.json`](content/locales.json) (`review*`, `report*`).

---

## Принципы пула

1. Каждый вопрос измеряет **одну ось**, без пересечений с соседними.
2. Диагностика UI (`pain`) — не отдельная всегда-видимая страница, а **условное продолжение** шкалы visual: только при низкой оценке.
3. Финальный вердикт — **рыночный уровень** (`tier`), не «нанял бы я в свой проект» (`hire` удалён).
4. Context и structure **разделены**: context = «понял ли задачу», structure = «удобно ли читать».
5. Старые `reviews.answers` с полем `hire` / visual 1–10 / pain `hierarchy|grid|ok` **не поддерживаются** — парсер жёстко ждёт новую схему.

```text
grade → context → structure → metrics → visual
                                         ├─ (visual ≤ 2) → pain → tier → advice
                                         └─ (visual ≥ 3) ─────────→ tier → advice
```

Progress в panel считает только **видимые** шаги (pain может отсутствовать).

---

## Схема `reviews.answers` (jsonb)

| Поле | Тип | Значения / диапазон | Обязательно |
|------|-----|---------------------|-------------|
| `grade` | string | `junior` · `mid` · `senior` · `staff` · `lead` · `head` | да |
| `context` | number | 1–5 | да |
| `structure` | string | `mess` · `dump` · `outline` · `clear` | да |
| `metrics` | string | `none` · `vanity` · `nominal` · `solid` · `strong` | да |
| `visual` | number | 1–5 | да |
| `pain` | string[] | `composition` · `contrast` · `components` · `overloaded` (можно `[]`) | нет (обычно только при visual ≤ 2) |
| `tier` | string | `early` · `mid` · `strong` · `top` | да |
| `advice` | string | 100–1000 символов в UI | да (пустая строка пройдёт парсер, но submit UI не пустит) |
| `dictation` | string | заметки с `/review` (после Web Speech + опц. polish пунктуации) | нет |

**Не путать** `answers.tier` (рынок кейсов) с `profiles.tier` (лиги ревью) — разные сущности.

Парсинг: `answersFromFormData` / `parseReviewAnswers` в `reviewReport.js`. Без валидного `tier` → `null` (лист не соберётся).

---

## Шаги квиза (UI)

| # | Вопрос (i18n) | Поле | UI | Варианты |
|---|---------------|------|-----|----------|
| 1 | `reviewGradeLabel` — «Кто сейчас был перед тобой?» | `grade` | radio | Джун · Миддл · Сеньор · Стафф · Лид · Хэд (+ hints) |
| 2 | `reviewContextLabel` — бизнес-задача и роль дизайнера | `context` | scale 1–5 | idle `reviewContextShort`; ступени `Value*` / `Hint*` |
| 3 | `reviewStructureLabel` — «Как устроена подача кейса?» | `structure` | radio | Простыня · Свалка · Каркас · Чёткая структура |
| 4 | `reviewMetricsLabel` — метрики | `metrics` | radio | Нет · Для галочки · Номинально · Динамика · Влияние на бизнес |
| 5 | `reviewVisualLabel` / short «Визуал» | `visual` | scale 1–5 | 5 ступеней (`reviewVisualValue1…5`) |
| 5a | `reviewPainLabel` — «Что конкретно тянет вниз?» | `pain[]` | checkbox | Только если **visual ≤ 2**. Composition · Contrast · Components · Overloaded. Можно пусто. Без «всё ок». |
| 6 | `reviewTierLabel` — уровень проектов / рынка | `tier` | radio | Рано · Средние компании · Сильные команды · Топ рынка |
| 7 | `reviewAdviceLabel` — главный совет | `advice` | textarea + mic | min 100 / max 1000; опц. надиктовка → тот же `advice`; перед submit — polish пунктуации (Edge) |

Авто-advance: single + scale (кроме pain и advice).  
При уходе с visual при значении ≥ 3 — pain checkbox сбрасываются.

Код: [`ReviewPanel.js`](src/components/review-panel/ReviewPanel.js) — `isVisible` на шаге pain, `findAdjacentVisibleStep`, `syncPainForVisual`.

---

## Трактовка в PDF / листе (`buildReportSections`)

Детерминированно, **без LLM** на L1/L2/L3. Вариант формулировки из банка 0/1 — hash(`seed` + key), обычно `seed = review_id`.  
(Отдельно: поля `advice` / `dictation` могут пройти post-edit пунктуации через Edge `polish-dictation` — это правка текста юзера, не генерация вердикта. Soft-fail: все модели / upstream упали → сырой текст, submit ок.)

### Зоны шкал (L1)

| Поле | Сырое | Зона → ключ |
|------|-------|-------------|
| `context` | 1–2 | `Low` → `reportContextLow*` |
| | 3 | `Mid` → `reportContextMid*` |
| | 4–5 | `High` → `reportContextHigh*` |
| `visual` | 1 | `Weak` → `reportVisualWeak*` |
| | 2 | `Ok` → `reportVisualOk*` |
| | 3 | `Good` → `reportVisualGood*` |
| | 4–5 | `Strong` → `reportVisualStrong*` |

Остальные поля L1: `reportGrade${Cap}` · `reportStructure${Cap}` · `reportMetrics${Cap}` · (preview) `reportTier${Cap}`.

**Pain-секция** (`reportPainTitle`): только если в `pain[]` есть известные пункты. При visual ≥ 3 секции обычно нет. Без нейтральной заглушки «всё ок».

### Режимы

| `mode` | Где | Что |
|--------|-----|-----|
| `preview` | живой лист справа в квизе | L1 + pain + `reportTier*` — **без** L2/L3 (ревьюер не видит комбо-вердикт) |
| `full` | `/report`, PDF | L2 (до 2 кросс-сигналов) → L1 (минус покрытые поля) → pain → **Итог** (lead + summary) → advice → dictation |

### L2 — кросс-сигналы (порядок = приоритет, max 2)

| id | Условие (кратко) | i18n key |
|----|------------------|----------|
| `gradeAboveTier` | senior+ и tier ∈ {early, mid} | `reportCrossGradeAboveTier` |
| `tierAboveGrade` | junior/mid и tier ∈ {strong, top} | `reportCrossTierAboveGrade` |
| `seniorMess` | senior+ и structure = mess | `reportCrossSeniorMess` |
| `juniorStrongVisual` | junior/mid и visual ≥ 4 | `reportCrossJuniorStrongVisual` |
| `noMetricsButHighTier` | metrics = none и high tier | `reportCrossNoMetricsButHighTier` |
| `strongMetricsButEarly` | metrics = strong и tier = early | `reportCrossStrongMetricsButEarly` |
| `contextOverloaded` | context ≤ 2 и pain overloaded | `reportCrossContextOverloaded` |
| `seniorWeakVisual` | senior+ и visual ≤ 2 | `reportCrossSeniorWeakVisual` |
| `clearNoMetricsMid` | clear + none + tier mid | `reportCrossClearNoMetricsMid` |
| `goodVisualBadContrast` | visual ≥ 3 и pain contrast | `reportCrossGoodVisualBadContrast` |
| `juniorEarlyComposition` | junior + early + composition | `reportCrossJuniorEarlyComposition` |
| `goldProfile` | context ≥ 4, metrics strong, visual ≥ 4, high tier | `reportCrossGoldProfile` |
| `dumpComponents` | dump + components | `reportCrossDumpComponents` |
| `midNoPain` | tier mid и нет pain | `reportCrossMidNoPain` |

`covers` / `coversPain` гасят дублирующий L1, чтобы не повторять тот же смысл.

### L3 — итог

Матрица **`tier × gradeZone`** (4 × 3 = 12 комбинаций × 2 варианта текста):

- `gradeZone`: junior → `Junior`; mid → `Mid`; senior/staff/lead/head → `SeniorPlus`
- ключ: `reportSummary${Cap(tier)}${gradeZone}${0|1}`  
  пример: `reportSummaryStrongMid0`

Перед сводкой всегда вставляется **`reportSummaryLead`**: пояснение, что грейд = чтение мышления, уровень рынка = что продают кейсы сейчас.

**Правило копирайта:** в `reportSummary*` не называть конкретный грейд словами (junior / middle / senior / стафф…) — только нейтрально («заявленный уровень», «текущий уровень», «рыночный сигнал»), иначе снова возможен баг противоречия грейд vs вердикт.

---

## i18n-карта

| Префикс | Назначение |
|---------|------------|
| `reviewGrade*` / `reviewContext*` / `reviewStructure*` / `reviewMetrics*` / `reviewVisual*` | вопросы и варианты квиза |
| `reviewPain*` | условная диагностика (composition, contrast, …) |
| `reviewTier*` | рыночный вердикт (4 уровня) |
| `reviewAdvice*` / `reviewAdviceRec*` | совет + mic |
| `reportGrade*` / `reportContext*` / `reportStructure*` / `reportMetrics*` / `reportVisual*` | L1 |
| `reportPain*` | pain-секция |
| `reportTier*` | L1 tier (preview) |
| `reportCross*` | L2 |
| `reportSummaryLead` / `reportSummary*` | L3 |
| `reportAdviceTitle` / `reportDictationTitle` | сырой/отполированный текст юзера (не LLM-вердикт L1–L3) |

Правило префиксов: [`.cursor/rules/i18n.mdc`](.cursor/rules/i18n.mdc).

---

## Тестовый сброс данных (оператор)

Чтобы прогнать карточки заново после смены схемы answers:

```sql
begin;
delete from public.review_claims;
delete from public.reviews;  -- review_complaints cascade
update public.portfolios
set reviews_count = 0, status = 'pending'
where status in ('pending', 'done');
commit;
```

Баланс монет SQL выше **не** откатывает. Клиентский SWR-кэш ленты — обновить home / logout.

---

## Файлы

| Файл | Роль |
|------|------|
| [`ReviewPanel.js`](src/components/review-panel/ReviewPanel.js) | шаги, conditional pain, FormData |
| [`ScaleSlider.js`](src/components/scale-slider/ScaleSlider.js) | шкалы 1–5 |
| [`reviewReport.js`](src/utils/reviewReport.js) | parse + L1/L2/L3 |
| [`reviewReport.dictation.test.js`](src/utils/reviewReport.dictation.test.js) | smoke tier/dictation |
| [`dictationPolish.js`](src/api/dictationPolish.js) | Edge post-edit пунктуации `advice` / `dictation`; soft-fail → сырой текст |
| [`polish-dictation`](supabase/functions/polish-dictation/README.md) | Z.AI Flash Edge (`glm-4.5-flash` + fallback) |
| [`shareReviewPdf.js`](src/utils/shareReviewPdf.js) | PDF одного листа |
| [`shareConsensusPdf.js`](src/utils/shareConsensusPdf.js) | сводный PDF (агрегаты + action cards) |
| [`ACTION_CARDS.md`](ACTION_CARDS.md) | majority → до 3 карточек на `/report` |
| [`report-screen`](src/components/report-screen/README.md) | авторский `/report` |
| [`locales.json`](content/locales.json) | все строки |

См. также: [`SCREENS.md`](SCREENS.md), [`PROJECT.md`](PROJECT.md) § Квиз и отчёт.
