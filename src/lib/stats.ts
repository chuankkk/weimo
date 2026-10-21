import type { AppState, PracticeRecord, QuestionType, WrongRow, WrongStatus } from "../types";
import { createCatalog, type Catalog } from "./catalog";
import { buildActivitySeries, currentStreak, isDue, localDateKey } from "./date";
import { TYPE_ORDER } from "./constants";

export interface Stats {
  totalQuestions: number;
  totalBanks: number;
  answered: number;
  correct: number;
  correctRate: number;
  todayCount: number;
  todayCorrect: number;
  todayCorrectRate: number;
  wrongActive: number;
  wrongMastered: number;
  dueReviews: number;
  streak: number;
  todayGoal: number;
  goalProgress: number;
  activity: ReturnType<typeof buildActivitySeries>;
}

export const computeStats = (state: AppState, catalog?: Catalog): Stats => {
  const index = catalog ?? createCatalog(state.banks, state.questions);
  const today = localDateKey();
  let answered = 0;
  let correct = 0;
  let todayCount = 0;
  let todayCorrect = 0;

  for (const record of state.records) {
    answered += 1;
    if (record.isCorrect) correct += 1;
    if (localDateKey(record.answeredAt) === today) {
      todayCount += 1;
      if (record.isCorrect) todayCorrect += 1;
    }
  }

  let wrongActive = 0;
  let wrongMastered = 0;
  let dueReviews = 0;
  for (const wrong of state.wrongs) {
    if (wrong.status === "active") {
      wrongActive += 1;
      if (isDue(wrong.nextReviewAt)) dueReviews += 1;
    } else if (wrong.status === "mastered") {
      wrongMastered += 1;
    }
  }

  const goal = Math.max(1, state.settings.reviewDailyTarget);
  return {
    totalQuestions: index.questions.length,
    totalBanks: index.roots.length,
    answered,
    correct,
    correctRate: answered ? Math.round((correct / answered) * 100) : 0,
    todayCount,
    todayCorrect,
    todayCorrectRate: todayCount ? Math.round((todayCorrect / todayCount) * 100) : 0,
    wrongActive,
    wrongMastered,
    dueReviews,
    streak: currentStreak(state.records),
    todayGoal: goal,
    goalProgress: Math.min(1, todayCount / goal),
    activity: buildActivitySeries(state.records)
  };
};

/** 知识点错误率：一次遍历记录，避免 记录 × 题目 的嵌套扫描。 */
export const computeKnowledgeRates = (
  records: PracticeRecord[],
  catalog: Catalog
): Map<string, { rate: number; total: number; wrong: number }> => {
  const totals = new Map<string, { total: number; wrong: number }>();
  for (const record of records) {
    const question = catalog.questionById.get(record.questionId);
    if (!question) continue;
    for (const point of question.knowledgePoints) {
      const row = totals.get(point) ?? { total: 0, wrong: 0 };
      row.total += 1;
      if (!record.isCorrect) row.wrong += 1;
      totals.set(point, row);
    }
  }
  const rates = new Map<string, { rate: number; total: number; wrong: number }>();
  for (const [point, row] of totals) {
    rates.set(point, { rate: row.total ? row.wrong / row.total : 0, ...row });
  }
  return rates;
};

export const weakKnowledgePoints = (
  rates: Map<string, { rate: number; total: number; wrong: number }>,
  limit = 6
) =>
  [...rates.entries()]
    .filter(([, row]) => row.wrong > 0 && row.total > 0)
    .sort((a, b) => b[1].rate - a[1].rate || b[1].wrong - a[1].wrong || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit)
    .map(([name, row]) => ({ name, ...row }));

export const computeKnowledgeRatesMap = (records: PracticeRecord[], catalog: Catalog) => {
  const detail = computeKnowledgeRates(records, catalog);
  const map = new Map<string, number>();
  for (const [key, value] of detail) map.set(key, value.rate);
  return map;
};

export const computeTypeAccuracy = (records: PracticeRecord[], catalog: Catalog) => {
  const result = TYPE_ORDER.reduce(
    (acc, type) => ({ ...acc, [type]: { total: 0, correct: 0 } }),
    {} as Record<QuestionType, { total: number; correct: number }>
  );
  for (const record of records) {
    const question = catalog.questionById.get(record.questionId);
    if (!question) continue;
    result[question.type].total += 1;
    if (record.isCorrect) result[question.type].correct += 1;
  }
  return result;
};

/** 错题行：附带题目对象，并按最近出错时间倒序。 */
export const buildWrongRows = (state: AppState, catalog: Catalog, bankId?: string): WrongRow[] => {
  const scope = bankId && bankId !== "all" ? new Set(catalog.subtreeIds(bankId)) : null;
  const rows: WrongRow[] = [];
  for (const wrong of state.wrongs) {
    const question = catalog.questionById.get(wrong.questionId);
    if (!question) continue;
    if (scope && !scope.has(question.bankId) && !scope.has(question.rootBankId)) continue;
    rows.push({ wrong, question });
  }
  return rows.sort((a, b) => b.wrong.lastWrongAt.localeCompare(a.wrong.lastWrongAt));
};

export const wrongCounts = (state: AppState, catalog: Catalog, bankId?: string) => {
  const counts: Record<WrongStatus, number> = { active: 0, mastered: 0, ignored: 0 };
  let due = 0;
  for (const { wrong } of buildWrongRows(state, catalog, bankId)) {
    counts[wrong.status] += 1;
    if (wrong.status === "active" && isDue(wrong.nextReviewAt)) due += 1;
  }
  return { ...counts, due };
};

export const recentRecords = (state: AppState, catalog: Catalog, limit = 6) => {
  const rows: { record: PracticeRecord; stem: string; type: QuestionType }[] = [];
  for (let index = state.records.length - 1; index >= 0 && rows.length < limit; index -= 1) {
    const record = state.records[index];
    const question = catalog.questionById.get(record.questionId);
    if (!question) continue;
    rows.push({ record, stem: question.stem, type: question.type });
  }
  return rows;
};

export const sessionRecords = (state: AppState, sessionId: string) =>
  state.records.filter((record) => record.sessionId === sessionId);

export const sessionSummary = (records: PracticeRecord[]) => {
  const total = records.length;
  const correct = records.filter((record) => record.isCorrect).length;
  return {
    total,
    correct,
    wrong: total - correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0
  };
};
