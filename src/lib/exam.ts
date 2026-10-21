import type {
  AppState,
  ExamBlueprintItem,
  ExamSession,
  ExamStatus,
  ExamTemplate,
  Question,
  QuestionType
} from "../types";
import type { Catalog } from "./catalog";
import { DEFAULT_SCORE_PER_TYPE, TYPE_ORDER } from "./constants";
import { nowIso } from "./date";
import { evaluateQuestion, sampleQuestions, shuffle, updateWrongAfterAnswer } from "./quiz";
import { uid } from "./text";

export const makeBlueprintItem = (catalog: Catalog, bankId: string): ExamBlueprintItem => {
  const counts = catalog.typeCounts(bankId);
  return {
    bankId,
    single: Math.min(5, counts.single),
    multiple: Math.min(3, counts.multiple),
    judge: Math.min(3, counts.judge),
    fill: Math.min(3, counts.fill)
  };
};

export const makeDefaultBlueprint = (catalog: Catalog): ExamBlueprintItem[] =>
  catalog.roots.map((bank) => makeBlueprintItem(catalog, bank.id));

export const blueprintTotal = (item: ExamBlueprintItem) =>
  TYPE_ORDER.reduce((sum, type) => sum + Math.max(0, Number(item[type]) || 0), 0);

export const blueprintQuestionCount = (blueprint: ExamBlueprintItem[]) =>
  blueprint.reduce((sum, item) => sum + blueprintTotal(item), 0);

export const blueprintMaxScore = (
  blueprint: ExamBlueprintItem[],
  scorePerType: Record<QuestionType, number> = DEFAULT_SCORE_PER_TYPE
) =>
  blueprint.reduce(
    (sum, item) =>
      sum + TYPE_ORDER.reduce((inner, type) => inner + Math.max(0, item[type] || 0) * (scorePerType[type] ?? 1), 0),
    0
  );

export const buildTemplate = (input: {
  id?: string;
  name: string;
  durationMinutes: number;
  blueprint: ExamBlueprintItem[];
  createdAt?: string;
}): ExamTemplate => ({
  id: input.id ?? uid("exam"),
  name: input.name.trim() || "自定义模拟考试",
  durationMinutes: Math.max(1, Math.round(input.durationMinutes || 1)),
  blueprint: input.blueprint
    .map((item) => ({
      ...item,
      single: Math.max(0, Math.floor(item.single)),
      multiple: Math.max(0, Math.floor(item.multiple)),
      judge: Math.max(0, Math.floor(item.judge)),
      fill: Math.max(0, Math.floor(item.fill))
    }))
    .filter((item) => blueprintTotal(item) > 0),
  shuffleQuestions: true,
  shuffleOptions: false,
  scorePerType: DEFAULT_SCORE_PER_TYPE,
  createdAt: input.createdAt ?? nowIso()
});

/** 按蓝图抽题，跨题库去重；题库内题量不足时自动取现有题。 */
export const pickExamQuestions = (catalog: Catalog, template: ExamTemplate): Question[] => {
  const picked = new Map<string, Question>();
  for (const item of template.blueprint) {
    for (const type of TYPE_ORDER) {
      const count = Math.max(0, item[type] || 0);
      if (!count) continue;
      for (const question of sampleQuestions(catalog.pool(item.bankId, [type]), count)) {
        picked.set(question.id, question);
      }
    }
  }
  const list = [...picked.values()];
  return template.shuffleQuestions ? shuffle(list) : list;
};

export const createExamSession = (template: ExamTemplate, questions: Question[]): ExamSession => ({
  id: uid("session"),
  templateId: template.id,
  name: template.name,
  questionIds: questions.map((question) => question.id),
  answers: {},
  marked: [],
  startedAt: nowIso(),
  durationMinutes: template.durationMinutes,
  status: "running",
  score: 0
});

export const examRemainingMs = (session: ExamSession, now = Date.now()) =>
  Math.max(0, new Date(session.startedAt).getTime() + session.durationMinutes * 60_000 - now);

export interface ExamTypeResult {
  type: QuestionType;
  total: number;
  correct: number;
  score: number;
  maxScore: number;
}

export interface ExamResult {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  byType: ExamTypeResult[];
  rows: {
    question: Question;
    answer: string[];
    isCorrect: boolean;
    score: number;
    maxScore: number;
  }[];
}

export const evaluateExam = (
  session: ExamSession,
  catalog: Catalog,
  template?: ExamTemplate
): ExamResult => {
  const scorePerType = template?.scorePerType ?? DEFAULT_SCORE_PER_TYPE;
  const rows: ExamResult["rows"] = [];
  let score = 0;
  let maxScore = 0;
  let correct = 0;
  let unanswered = 0;

  for (const questionId of session.questionIds) {
    const question = catalog.questionById.get(questionId);
    if (!question) continue;
    const answer = session.answers[questionId] ?? [];
    const evaluation = evaluateQuestion(question, answer);
    const itemMax = scorePerType[question.type] ?? 1;
    const itemScore = evaluation.isCorrect ? itemMax : 0;
    if (!answer.filter(Boolean).length) unanswered += 1;
    score += itemScore;
    maxScore += itemMax;
    if (evaluation.isCorrect) correct += 1;
    rows.push({ question, answer, isCorrect: evaluation.isCorrect, score: itemScore, maxScore: itemMax });
  }

  const byType = TYPE_ORDER.map((type) => {
    const list = rows.filter((row) => row.question.type === type);
    return {
      type,
      total: list.length,
      correct: list.filter((row) => row.isCorrect).length,
      score: list.reduce((sum, row) => sum + row.score, 0),
      maxScore: list.reduce((sum, row) => sum + row.maxScore, 0)
    };
  });

  return {
    score,
    maxScore,
    correct,
    wrong: rows.length - correct - unanswered,
    unanswered,
    total: rows.length,
    byType,
    rows
  };
};

/**
 * 交卷：一次性写入成绩、练习记录和错题回流。
 * 幂等——已交卷的 session 不会重复计分。
 */
export const finalizeExam = (
  state: AppState,
  sessionId: string,
  catalog: Catalog,
  status: ExamStatus = "submitted"
): AppState => {
  const session = state.examSessions.find((item) => item.id === sessionId);
  if (!session || session.status !== "running") return state;
  const template = state.exams.find((item) => item.id === session.templateId);
  const result = evaluateExam(session, catalog, template);
  const answeredAt = nowIso();
  const records = [...state.records];
  let wrongs = [...state.wrongs];

  for (const row of result.rows) {
    records.push({
      id: uid("record"),
      questionId: row.question.id,
      sessionId: session.id,
      mode: "exam",
      userAnswer: row.answer,
      isCorrect: row.isCorrect,
      score: row.score,
      timeSpentMs: 0,
      answeredAt
    });
    wrongs = updateWrongAfterAnswer(wrongs, row.question.id, row.isCorrect, answeredAt);
  }

  return {
    ...state,
    records,
    wrongs,
    examSessions: state.examSessions.map((item) =>
      item.id === sessionId
        ? { ...item, status, submittedAt: answeredAt, score: result.score }
        : item
    )
  };
};

export const runningExamSession = (state: AppState) =>
  [...state.examSessions].reverse().find((session) => session.status === "running");

export const submittedExamSessions = (state: AppState) =>
  [...state.examSessions]
    .filter((session) => session.status !== "running")
    .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt));
