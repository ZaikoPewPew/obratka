/**
 * Сводка ответов ревью → тексты трактовок для PDF-отчёта.
 * Сейчас один ревьюер; API рассчитан и на агрегаты (majority / avg).
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

  return { grade, context, structure, metrics, visual, hire, advice, pain };
}

/**
 * @param {ReviewAnswers} answers
 * @param {Record<string, string>} t
 * @returns {ReportSection[]}
 */
export function buildReportSections(answers, t) {
  /** @type {ReportSection[]} */
  const sections = [
    {
      title: t.reportGradeTitle,
      body: gradeText(answers.grade, t),
    },
    {
      title: t.reportContextTitle,
      body: contextText(answers.context, t),
    },
    {
      title: t.reportStructureTitle,
      body: structureText(answers.structure, t),
    },
    {
      title: t.reportMetricsTitle,
      body: metricsText(answers.metrics, t),
    },
    {
      title: t.reportVisualTitle,
      body: visualText(answers.visual, t),
    },
    {
      title: t.reportHireTitle,
      body: hireText(answers.hire, t),
    },
  ];

  if (answers.advice) {
    sections.push({
      title: t.reportAdviceTitle,
      body: answers.advice,
    });
  }

  return sections;
}

/**
 * @param {Grade} grade
 * @param {Record<string, string>} t
 */
function gradeText(grade, t) {
  switch (grade) {
    case "head":
      return t.reportGradeHead;
    case "lead":
      return t.reportGradeLead;
    case "staff":
      return t.reportGradeStaff;
    case "senior":
      return t.reportGradeSenior;
    case "mid":
      return t.reportGradeMid;
    case "junior":
      return t.reportGradeJunior;
    default: {
      const _exhaustive = grade;
      return _exhaustive;
    }
  }
}

/**
 * @param {number} score
 * @param {Record<string, string>} t
 */
function contextText(score, t) {
  return score >= 4 ? t.reportContextHigh : t.reportContextLow;
}

/**
 * @param {Structure} structure
 * @param {Record<string, string>} t
 */
function structureText(structure, t) {
  switch (structure) {
    case "clear":
      return t.reportStructureClear;
    case "outline":
      return t.reportStructureOutline;
    case "dump":
      return t.reportStructureDump;
    case "mess":
      return t.reportStructureMess;
    default: {
      const _exhaustive = structure;
      return _exhaustive;
    }
  }
}

/**
 * @param {Metrics} metrics
 * @param {Record<string, string>} t
 */
function metricsText(metrics, t) {
  switch (metrics) {
    case "none":
      return t.reportMetricsNone;
    case "vanity":
      return t.reportMetricsVanity;
    case "nominal":
      return t.reportMetricsNominal;
    case "solid":
      return t.reportMetricsSolid;
    case "strong":
      return t.reportMetricsStrong;
    default: {
      const _exhaustive = metrics;
      return _exhaustive;
    }
  }
}

/**
 * @param {number} score
 * @param {Record<string, string>} t
 */
function visualText(score, t) {
  return score >= 8 ? t.reportVisualHigh : t.reportVisualLow;
}

/**
 * @param {Hire} hire
 * @param {Record<string, string>} t
 */
function hireText(hire, t) {
  switch (hire) {
    case "yes":
      return t.reportHireYes;
    case "maybe":
      return t.reportHireMaybe;
    case "no":
      return t.reportHireNo;
    default: {
      const _exhaustive = hire;
      return _exhaustive;
    }
  }
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
