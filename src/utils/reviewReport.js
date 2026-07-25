/**
 * Сводка ответов ревью → тексты трактовок для отчёта.
 *
 * Детерминированно, без LLM:
 *  - L1 per-field: зоны шкал (context / visual) + грейд / структура / метрики.
 *  - L2 cross-signal: комбинации 2-3 полей → приоритетная трактовка,
 *    перекрывает дублирующий L1 (`covers` / `coversPain`).
 *  - L3 summary: итоговый вердикт `hire × gradeZone` (только `mode: "full"`).
 *
 * `mode: "preview"` (живой лист в квизе) — только L1 + hire + pain, без L2/L3,
 * чтобы ревьюер не видел, как ответы складываются в «комбо-вердикт».
 *
 * Вариативность формулировок — детерминированный hash по `seed` (review_id),
 * не `Math.random()`: одинаковые answers + seed → одинаковый текст.
 *
 * `grade` = оценка уровня АВТОРА портфолио (её ставит ревьюер), не грейд ревьюера.
 * Опционально `answers.dictation` — надиктовка с `/review` (см. src/lib/dictation/).
 */

/**
 * @typedef {'junior' | 'mid' | 'senior' | 'staff' | 'lead' | 'head'} Grade
 * @typedef {'mess' | 'dump' | 'outline' | 'clear'} Structure
 * @typedef {'none' | 'vanity' | 'nominal' | 'solid' | 'strong'} Metrics
 * @typedef {'yes' | 'maybe' | 'no'} Hire
 *
 * @typedef {{
 *   grade: Grade;
 *   context: number;
 *   structure: Structure;
 *   metrics: Metrics;
 *   visual: number;
 *   hire: Hire;
 *   advice: string;
 *   dictation?: string;
 *   pain?: string[];
 * }} ReviewAnswers
 *
 * @typedef {{ title: string; body: string }} ReportSection
 */

/**
 * @param {FormData} formData
 * @returns {ReviewAnswers | null}
 */
export function answersFromFormData(formData) {
  const grade = String(formData.get("grade") || "");
  const structure = String(formData.get("structure") || "");
  const metrics = String(formData.get("metrics") || "");
  const hire = String(formData.get("hire") || "");
  const context = Number(formData.get("context"));
  const visual = Number(formData.get("visual"));
  const advice = String(formData.get("advice") || "").trim();
  const pain = formData
    .getAll("pain")
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (
    !isGrade(grade) ||
    !isStructure(structure) ||
    !isMetrics(metrics) ||
    !isHire(hire) ||
    !Number.isFinite(context) ||
    !Number.isFinite(visual)
  ) {
    return null;
  }

  return { grade, context, structure, metrics, visual, hire, advice, pain };
}

/**
 * Разобрать `reviews.answers` jsonb с сервера.
 * @param {unknown} raw
 * @returns {ReviewAnswers | null}
 */
export function parseReviewAnswers(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = /** @type {Record<string, unknown>} */ (raw);
  const grade = String(row.grade || "");
  const structure = String(row.structure || "");
  const metrics = String(row.metrics || "");
  const hire = String(row.hire || "");
  const context = Number(row.context);
  const visual = Number(row.visual);
  const advice = typeof row.advice === "string" ? row.advice.trim() : "";
  const dictation =
    typeof row.dictation === "string" ? row.dictation.trim() : "";
  const pain = Array.isArray(row.pain)
    ? row.pain.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (
    !isGrade(grade) ||
    !isStructure(structure) ||
    !isMetrics(metrics) ||
    !isHire(hire) ||
    !Number.isFinite(context) ||
    !Number.isFinite(visual)
  ) {
    return null;
  }

  /** @type {ReviewAnswers} */
  const answers = { grade, context, structure, metrics, visual, hire, advice, pain };
  if (dictation) answers.dictation = dictation;
  return answers;
}

/**
 * Приоритет проблем интерфейса (`pain`): чем раньше — тем важнее.
 * Значение `ok` (взаимоисключающее) обрабатывается отдельно.
 * @type {string[]}
 */
const PAIN_PRIORITY = ["overloaded", "contrast", "hierarchy", "grid", "components"];

/**
 * L2 cross-signals: порядок в массиве = приоритет. Берём максимум 2.
 * `grade` — оценка уровня автора. `covers` гасит дублирующий per-field L1,
 * `coversPain` — конкретные пункты pain, чтобы не повторяться.
 * @type {{
 *   id: string;
 *   key: string;
 *   covers: string[];
 *   coversPain?: string[];
 *   test: (a: ReviewAnswers) => boolean;
 * }[]}
 */
const CROSS_SIGNALS = [
  {
    id: "seniorMess",
    key: "reportCrossSeniorMess",
    covers: ["grade", "structure"],
    test: (a) => isSeniorPlus(a.grade) && a.structure === "mess",
  },
  {
    id: "juniorStrongVisual",
    key: "reportCrossJuniorStrongVisual",
    covers: ["visual"],
    test: (a) => (a.grade === "junior" || a.grade === "mid") && a.visual >= 8,
  },
  {
    id: "noMetricsButHire",
    key: "reportCrossNoMetricsButHire",
    covers: ["metrics"],
    test: (a) => a.metrics === "none" && a.hire === "yes",
  },
  {
    id: "strongMetricsNoHire",
    key: "reportCrossStrongMetricsNoHire",
    covers: ["metrics"],
    test: (a) => a.metrics === "strong" && a.hire === "no",
  },
  {
    id: "contextOverloaded",
    key: "reportCrossContextOverloaded",
    covers: ["context"],
    coversPain: ["overloaded"],
    test: (a) => a.context <= 2 && hasPain(a, "overloaded"),
  },
  {
    id: "seniorWeakVisual",
    key: "reportCrossSeniorWeakVisual",
    covers: ["visual"],
    test: (a) => isSeniorPlus(a.grade) && a.visual <= 4,
  },
  {
    id: "clearNoMetricsMaybe",
    key: "reportCrossClearNoMetricsMaybe",
    covers: ["structure", "metrics"],
    test: (a) =>
      a.structure === "clear" && a.metrics === "none" && a.hire === "maybe",
  },
  {
    id: "goodVisualBadContrast",
    key: "reportCrossGoodVisualBadContrast",
    covers: [],
    coversPain: ["contrast"],
    test: (a) => a.visual >= 7 && hasPain(a, "contrast"),
  },
  {
    id: "juniorNoHireGrid",
    key: "reportCrossJuniorNoHireGrid",
    covers: [],
    coversPain: ["grid"],
    test: (a) => a.grade === "junior" && a.hire === "no" && hasPain(a, "grid"),
  },
  {
    id: "goldProfile",
    key: "reportCrossGoldProfile",
    covers: ["context", "metrics", "visual"],
    test: (a) =>
      a.context >= 4 && a.metrics === "strong" && a.visual >= 8 && a.hire === "yes",
  },
  {
    id: "dumpComponents",
    key: "reportCrossDumpComponents",
    covers: ["structure"],
    coversPain: ["components"],
    test: (a) => a.structure === "dump" && hasPain(a, "components"),
  },
  {
    id: "maybeNoPain",
    key: "reportCrossMaybeNoPain",
    covers: [],
    test: (a) => a.hire === "maybe" && !hasAnyRealPain(a),
  },
];

/**
 * @param {ReviewAnswers} answers
 * @param {Record<string, string>} t
 * @param {{ mode?: "preview" | "full"; seed?: string | number }} [opts]
 *   `mode` — `full` (по умолчанию, отчёт автору / PDF) или `preview` (лист в квизе).
 *   `seed` — стабильный ключ (обычно `review_id`) для разнообразия между листами.
 * @returns {ReportSection[]}
 */
export function buildReportSections(answers, t, opts = {}) {
  const mode = opts.mode === "preview" ? "preview" : "full";
  const seed = String(opts.seed || seedFromAnswers(answers));

  /** @type {ReportSection[]} */
  const sections = [];
  /** Поля per-field, перекрытые сработавшим кросс-сигналом. */
  const covered = new Set();
  /** Пункты pain, перекрытые кросс-сигналом. */
  const suppressedPain = new Set();

  if (mode === "full") {
    const matched = CROSS_SIGNALS.filter((rule) => rule.test(answers)).slice(0, 2);
    matched.forEach((rule, index) => {
      sections.push({
        title: index === 0 ? t.reportCrossTitle : t.reportCrossTitle2,
        body: variant(t, rule.key, 1, seed),
      });
      for (const field of rule.covers) covered.add(field);
      for (const pain of rule.coversPain ?? []) suppressedPain.add(pain);
    });
  }

  if (!covered.has("grade")) {
    sections.push({
      title: t.reportGradeTitle,
      body: variant(t, `reportGrade${cap(answers.grade)}`, 2, seed),
    });
  }
  if (!covered.has("context")) {
    sections.push({
      title: t.reportContextTitle,
      body: variant(t, `reportContext${contextZone(answers.context)}`, 2, seed),
    });
  }
  if (!covered.has("structure")) {
    sections.push({
      title: t.reportStructureTitle,
      body: variant(t, `reportStructure${cap(answers.structure)}`, 2, seed),
    });
  }
  if (!covered.has("metrics")) {
    sections.push({
      title: t.reportMetricsTitle,
      body: variant(t, `reportMetrics${cap(answers.metrics)}`, 2, seed),
    });
  }
  if (!covered.has("visual")) {
    sections.push({
      title: t.reportVisualTitle,
      body: variant(t, `reportVisual${visualZone(answers.visual)}`, 2, seed),
    });
  }

  const painSection = buildPainSection(answers, t, seed, suppressedPain);
  if (painSection) sections.push(painSection);

  if (mode === "preview") {
    sections.push({
      title: t.reportHireTitle,
      body: variant(t, `reportHire${cap(answers.hire)}`, 2, seed),
    });
  } else {
    sections.push({
      title: t.reportSummaryTitle,
      body: variant(
        t,
        `reportSummary${cap(answers.hire)}${gradeZone(answers.grade)}`,
        2,
        seed,
      ),
    });
  }

  if (answers.advice) {
    sections.push({ title: t.reportAdviceTitle, body: answers.advice });
  }
  if (answers.dictation) {
    sections.push({ title: t.reportDictationTitle, body: answers.dictation });
  }

  return sections;
}

/**
 * Блок «проблемы интерфейса» (`pain`) — одной секцией.
 * @param {ReviewAnswers} answers
 * @param {Record<string, string>} t
 * @param {string} seed
 * @param {Set<string>} suppressed
 * @returns {ReportSection | null}
 */
function buildPainSection(answers, t, seed, suppressed) {
  const pain = Array.isArray(answers.pain) ? answers.pain : [];
  if (pain.length === 0) return null;
  if (pain.includes("ok")) {
    return { title: t.reportPainTitle, body: variant(t, "reportPainOk", 2, seed) };
  }

  const known = PAIN_PRIORITY.filter(
    (item) => pain.includes(item) && !suppressed.has(item),
  );
  if (known.length === 0) return null;

  const selected = known.length >= 3 ? known.slice(0, 2) : known;
  const parts = selected
    .map((item) => variant(t, `reportPain${cap(item)}`, 2, seed))
    .filter(Boolean);
  if (known.length >= 3) {
    const more = variant(t, "reportPainMultiple", 1, seed);
    if (more) parts.push(more);
  }
  if (parts.length === 0) return null;

  return { title: t.reportPainTitle, body: parts.join(" ") };
}

/**
 * Детерминированная 32-битная строковая хеш-функция (без Math.random()).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Индекс шаблона из банка по seed+key. При bank <= 1 всегда 0.
 * @param {string} seed
 * @param {string} key
 * @param {number} bank
 * @returns {number}
 */
function pickIndex(seed, key, bank) {
  if (bank <= 1) return 0;
  return hashString(`${seed}:${key}`) % bank;
}

/**
 * Текст шаблона: `${base}${idx}` с фолбэком на `${base}` (совместимость).
 * @param {Record<string, string>} t
 * @param {string} base
 * @param {number} bank
 * @param {string} seed
 * @returns {string}
 */
function variant(t, base, bank, seed) {
  const idx = pickIndex(seed, base, bank);
  return t[`${base}${idx}`] ?? t[base] ?? "";
}

/**
 * Seed по умолчанию, если `review_id` не передан.
 * @param {ReviewAnswers} a
 * @returns {string}
 */
function seedFromAnswers(a) {
  return `${a.grade}:${a.structure}:${a.metrics}:${a.hire}:${a.context}:${a.visual}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Зона шкалы «ясность бизнеса» (1-5).
 * @param {number} score
 * @returns {"Low" | "Mid" | "High"}
 */
function contextZone(score) {
  if (score <= 2) return "Low";
  if (score === 3) return "Mid";
  return "High";
}

/**
 * Зона визуального качества (1-10).
 * @param {number} score
 * @returns {"Weak" | "Ok" | "Good" | "Strong"}
 */
function visualZone(score) {
  if (score <= 4) return "Weak";
  if (score <= 6) return "Ok";
  if (score <= 8) return "Good";
  return "Strong";
}

/**
 * Лига автора для summary-матрицы.
 * @param {Grade} grade
 * @returns {"Junior" | "Mid" | "SeniorPlus"}
 */
function gradeZone(grade) {
  if (grade === "junior") return "Junior";
  if (grade === "mid") return "Mid";
  return "SeniorPlus";
}

/**
 * @param {Grade} grade
 * @returns {boolean}
 */
function isSeniorPlus(grade) {
  return (
    grade === "senior" ||
    grade === "staff" ||
    grade === "lead" ||
    grade === "head"
  );
}

/**
 * @param {ReviewAnswers} a
 * @param {string} item
 * @returns {boolean}
 */
function hasPain(a, item) {
  return Array.isArray(a.pain) && a.pain.includes(item);
}

/**
 * Есть ли хотя бы одна реальная проблема (не пусто и не только `ok`).
 * @param {ReviewAnswers} a
 * @returns {boolean}
 */
function hasAnyRealPain(a) {
  if (!Array.isArray(a.pain) || a.pain.length === 0) return false;
  return a.pain.some((item) => item !== "ok");
}

/**
 * @param {string} value
 * @returns {value is Grade}
 */
function isGrade(value) {
  return (
    value === "junior" ||
    value === "mid" ||
    value === "senior" ||
    value === "staff" ||
    value === "lead" ||
    value === "head"
  );
}

/**
 * @param {string} value
 * @returns {value is Structure}
 */
function isStructure(value) {
  return (
    value === "mess" ||
    value === "dump" ||
    value === "outline" ||
    value === "clear"
  );
}

/**
 * @param {string} value
 * @returns {value is Metrics}
 */
function isMetrics(value) {
  return (
    value === "none" ||
    value === "vanity" ||
    value === "nominal" ||
    value === "solid" ||
    value === "strong"
  );
}

/**
 * @param {string} value
 * @returns {value is Hire}
 */
function isHire(value) {
  return value === "yes" || value === "maybe" || value === "no";
}
