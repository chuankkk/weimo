import { createSeedState } from "./seed";
import type {
  AppState,
  ExamBlueprintItem,
  ExamSession,
  ExamTemplate,
  PracticeRecord,
  PracticeSessionState,
  Question,
  QuestionBank,
  QuestionOption,
  QuestionType,
  Settings,
  ThemeMode,
  UserNote,
  WrongQuestion,
  WrongStatus
} from "../types";
import { DEFAULT_SCORE_PER_TYPE, SCHEMA_VERSION, STORAGE_KEY, TYPE_ORDER } from "../lib/constants";
import { nowIso } from "../lib/date";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
const asIso = (value: unknown, fallback = nowIso()) => {
  const text = asString(value);
  return text && !Number.isNaN(new Date(text).getTime()) ? text : fallback;
};
const isValidType = (value: unknown): value is QuestionType =>
  typeof value === "string" && (TYPE_ORDER as string[]).includes(value);
const isTheme = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";
const isWrongStatus = (value: unknown): value is WrongStatus =>
  value === "active" || value === "mastered" || value === "ignored";

const normalizeOptions = (value: unknown): QuestionOption[] => {
  if (!Array.isArray(value)) return [];
  const options: QuestionOption[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const key = asString(item.key).trim();
    const text = asString(item.text).trim();
    if (key && text) options.push({ key, text });
  }
  return options;
};

const normalizeBanks = (value: unknown): QuestionBank[] => {
  if (!Array.isArray(value)) return createSeedState().banks;
  const seen = new Set<string>();
  const banks: QuestionBank[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = asString(item.id).trim();
    const name = asString(item.name).trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const created = asIso(item.createdAt);
    banks.push({
      id,
      name,
      description: asString(item.description).trim(),
      parentId: asString(item.parentId).trim() || undefined,
      sortIndex: asNumber(item.sortIndex, banks.length + 1),
      color: asString(item.color, "#2C4B43"),
      createdAt: created,
      updatedAt: asIso(item.updatedAt, created),
      archived: Boolean(item.archived)
    });
  }

  const byId = new Map(banks.map((bank) => [bank.id, bank]));
  for (const bank of banks) {
    if (!bank.parentId) continue;
    if (!byId.has(bank.parentId)) {
      bank.parentId = undefined;
      continue;
    }
    // 防止循环引用导致目录树无限递归
    let cursor = byId.get(bank.parentId);
    let guard = 0;
    while (cursor && guard < 10) {
      if (cursor.id === bank.id) {
        bank.parentId = undefined;
        break;
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      guard += 1;
    }
  }
  return banks;
};

const rootIdOf = (banks: QuestionBank[], bankId: string) => {
  const byId = new Map(banks.map((bank) => [bank.id, bank]));
  let cursor = byId.get(bankId);
  let guard = 0;
  while (cursor?.parentId && guard < 10) {
    cursor = byId.get(cursor.parentId);
    guard += 1;
  }
  return cursor?.id ?? bankId;
};

const normalizeQuestions = (value: unknown, banks: QuestionBank[]): Question[] => {
  const defaults = createSeedState().questions;
  if (!Array.isArray(value)) return defaults.filter((question) => banks.some((bank) => bank.id === question.bankId));
  const bankIds = new Set(banks.map((bank) => bank.id));
  const seen = new Set<string>();
  const questions: Question[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = asString(item.id).trim();
    const stem = asString(item.stem).trim();
    const bankId = asString(item.bankId).trim();
    const type = item.type;
    if (!id || !stem || !bankId || !bankIds.has(bankId) || !isValidType(type) || seen.has(id)) continue;
    seen.add(id);
    const created = asIso(item.createdAt);
    const options = normalizeOptions(item.options);
    const answer = asStringArray(item.answer);
    if ((type === "single" || type === "multiple") && (options.length < 2 || !answer.length)) continue;
    if ((type === "judge" || type === "fill") && !answer.length) continue;
    const aliases = Array.isArray(item.answerAliases)
      ? item.answerAliases.map((entry) => asStringArray(entry)).filter((entry) => entry.length)
      : [];
    questions.push({
      id,
      bankId,
      rootBankId: rootIdOf(banks, bankId),
      type,
      stem,
      options,
      answer,
      answerAliases: aliases,
      explanation: asString(item.explanation),
      knowledgePoints: asStringArray(item.knowledgePoints),
      tags: asStringArray(item.tags),
      difficulty: Math.min(5, Math.max(1, Math.round(asNumber(item.difficulty, 2)))),
      source: asString(item.source),
      sortIndex: asNumber(item.sortIndex, questions.length + 1),
      createdAt: created,
      updatedAt: asIso(item.updatedAt, created),
      fingerprint: asString(item.fingerprint)
    });
  }
  return questions;
};

const normalizeRecords = (value: unknown, questionIds: Set<string>): PracticeRecord[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const records: PracticeRecord[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const questionId = asString(item.questionId);
    const id = asString(item.id);
    if (!id || !questionId || !questionIds.has(questionId) || seen.has(id)) continue;
    seen.add(id);
    const mode = asString(item.mode);
    records.push({
      id,
      questionId,
      sessionId: asString(item.sessionId, "legacy"),
      mode: (["sequence", "random", "weighted", "wrong", "exam"] as string[]).includes(mode)
        ? (mode as PracticeRecord["mode"])
        : "sequence",
      userAnswer: asStringArray(item.userAnswer),
      isCorrect: Boolean(item.isCorrect),
      score: asNumber(item.score, item.isCorrect ? 1 : 0),
      timeSpentMs: Math.max(0, asNumber(item.timeSpentMs, 0)),
      answeredAt: asIso(item.answeredAt)
    });
  }
  return records;
};

const normalizeWrongs = (value: unknown, questionIds: Set<string>): WrongQuestion[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const wrongs: WrongQuestion[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const questionId = asString(item.questionId);
    if (!questionId || !questionIds.has(questionId) || seen.has(questionId)) continue;
    seen.add(questionId);
    const lastWrongAt = asIso(item.lastWrongAt);
    wrongs.push({
      questionId,
      wrongCount: Math.max(0, Math.round(asNumber(item.wrongCount, 1))),
      correctAfterWrongCount: Math.max(0, Math.round(asNumber(item.correctAfterWrongCount, 0))),
      lastWrongAt,
      lastCorrectAt: item.lastCorrectAt ? asIso(item.lastCorrectAt) : undefined,
      masteryLevel: Math.min(5, Math.max(0, Math.round(asNumber(item.masteryLevel, 0)))),
      wrongReasons: asStringArray(item.wrongReasons),
      status: isWrongStatus(item.status) ? item.status : "active",
      nextReviewAt: asIso(item.nextReviewAt, lastWrongAt)
    });
  }
  return wrongs;
};

const normalizeNotes = (value: unknown, questionIds: Set<string>): UserNote[] => {
  if (!Array.isArray(value)) return [];
  const byQuestion = new Map<string, UserNote>();
  for (const item of value) {
    if (!isObject(item)) continue;
    const questionId = asString(item.questionId);
    const content = asString(item.content).trim();
    if (!questionId || !content || !questionIds.has(questionId)) continue;
    const updatedAt = asIso(item.updatedAt);
    const note: UserNote = {
      id: asString(item.id) || `note-${questionId}`,
      questionId,
      content,
      updatedAt
    };
    const existing = byQuestion.get(questionId);
    if (!existing || existing.updatedAt < updatedAt) byQuestion.set(questionId, note);
  }
  return [...byQuestion.values()];
};

const normalizeExams = (value: unknown, banks: QuestionBank[]): ExamTemplate[] => {
  const source = Array.isArray(value) ? value : createSeedState().exams;
  const bankIds = new Set(banks.filter((bank) => !bank.archived).map((bank) => bank.id));
  const exams: ExamTemplate[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    if (!isObject(item)) continue;
    const id = asString(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const blueprint: ExamBlueprintItem[] = Array.isArray(item.blueprint)
      ? item.blueprint
          .filter(isObject)
          .map((entry) => ({
            bankId: asString(entry.bankId),
            single: Math.max(0, Math.round(asNumber(entry.single))),
            multiple: Math.max(0, Math.round(asNumber(entry.multiple))),
            judge: Math.max(0, Math.round(asNumber(entry.judge))),
            fill: Math.max(0, Math.round(asNumber(entry.fill)))
          }))
          .filter((entry) => bankIds.has(entry.bankId))
      : [];
    const scorePerType = { ...DEFAULT_SCORE_PER_TYPE };
    if (isObject(item.scorePerType)) {
      for (const type of TYPE_ORDER) scorePerType[type] = Math.max(0, asNumber(item.scorePerType[type], scorePerType[type]));
    }
    exams.push({
      id,
      name: asString(item.name, "未命名策略"),
      durationMinutes: Math.max(1, Math.round(asNumber(item.durationMinutes, 90))),
      blueprint,
      shuffleQuestions: item.shuffleQuestions !== false,
      shuffleOptions: Boolean(item.shuffleOptions),
      scorePerType,
      createdAt: asIso(item.createdAt)
    });
  }
  return exams;
};

const normalizeExamSessions = (value: unknown, questionIds: Set<string>): ExamSession[] => {
  if (!Array.isArray(value)) return [];
  const sessions: ExamSession[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = asString(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const ids = Array.isArray(item.questionIds)
      ? [...new Set(item.questionIds.map((entry) => asString(entry)).filter((entry) => questionIds.has(entry)))]
      : [];
    if (!ids.length) continue;
    const answers: Record<string, string[]> = {};
    if (isObject(item.answers)) {
      for (const [key, answer] of Object.entries(item.answers)) {
        if (questionIds.has(key)) answers[key] = asStringArray(answer);
      }
    }
    const status = item.status === "submitted" || item.status === "timeout" ? item.status : "running";
    sessions.push({
      id,
      templateId: asString(item.templateId),
      name: asString(item.name, "模拟考试"),
      questionIds: ids,
      answers,
      marked: Array.isArray(item.marked) ? item.marked.map((entry) => asString(entry)).filter((entry) => ids.includes(entry)) : [],
      startedAt: asIso(item.startedAt),
      submittedAt: item.submittedAt ? asIso(item.submittedAt) : undefined,
      durationMinutes: Math.max(1, Math.round(asNumber(item.durationMinutes, 90))),
      status,
      score: asNumber(item.score, 0),
      currentIndex: Math.min(ids.length - 1, Math.max(0, Math.round(asNumber(item.currentIndex, 0))))
    });
  }
  return sessions;
};

const normalizePracticeSession = (value: unknown, questionIds: Set<string>): PracticeSessionState | null => {
  if (!isObject(value)) return null;
  const ids = Array.isArray(value.questionIds)
    ? value.questionIds.map((entry) => asString(entry)).filter((entry) => questionIds.has(entry))
    : [];
  if (!ids.length) return null;
  const answers: Record<string, string[]> = {};
  if (isObject(value.answers)) {
    for (const [key, answer] of Object.entries(value.answers)) {
      if (ids.includes(key)) answers[key] = asStringArray(answer);
    }
  }
  const submitted: Record<string, boolean> = {};
  if (isObject(value.submitted)) {
    for (const [key, flag] of Object.entries(value.submitted)) {
      if (ids.includes(key) && flag) submitted[key] = true;
    }
  }
  const mode = ["sequence", "random", "weighted", "wrong"].includes(asString(value.mode))
    ? (asString(value.mode) as PracticeSessionState["mode"])
    : "sequence";
  return {
    id: asString(value.id) || "practice-legacy",
    mode,
    questionIds: ids,
    currentIndex: Math.min(ids.length - 1, Math.max(0, Math.round(asNumber(value.currentIndex, 0)))),
    answers,
    submitted,
    startedAt: asIso(value.startedAt),
    questionStartedAt: value.questionStartedAt ? asIso(value.questionStartedAt) : undefined,
    completedAt: value.completedAt ? asIso(value.completedAt) : undefined
  };
};

const normalizeSettings = (value: unknown): Settings => {
  const defaults = createSeedState().settings;
  if (!isObject(value)) return defaults;
  return {
    theme: isTheme(value.theme) ? value.theme : defaults.theme,
    autoNext: Boolean(value.autoNext),
    weightedWrongStrength: Math.min(5, Math.max(1, Math.round(asNumber(value.weightedWrongStrength, defaults.weightedWrongStrength)))),
    weightedKnowledgeStrength: Math.min(5, Math.max(1, Math.round(asNumber(value.weightedKnowledgeStrength, defaults.weightedKnowledgeStrength)))),
    reviewDailyTarget: Math.min(200, Math.max(5, Math.round(asNumber(value.reviewDailyTarget, defaults.reviewDailyTarget))))
  };
};

/** 把任意来源（旧版本 localStorage / 备份 JSON）规整为可信的 AppState。 */
export const normalizeState = (raw: unknown): AppState => {
  const base = createSeedState();
  if (!isObject(raw)) return base;
  const banks = normalizeBanks(raw.banks);
  const questions = normalizeQuestions(raw.questions, banks);
  const questionIds = new Set(questions.map((question) => question.id));
  return {
    schemaVersion: SCHEMA_VERSION,
    banks,
    questions,
    records: normalizeRecords(raw.records, questionIds),
    wrongs: normalizeWrongs(raw.wrongs, questionIds),
    notes: normalizeNotes(raw.notes, questionIds),
    exams: normalizeExams(raw.exams, banks),
    examSessions: normalizeExamSessions(raw.examSessions, questionIds),
    practiceSession: normalizePracticeSession(raw.practiceSession, questionIds),
    settings: normalizeSettings(raw.settings)
  };
};

export interface LoadResult {
  state: AppState;
  warning?: string;
}

export const loadState = (): LoadResult => {
  if (typeof window === "undefined") return { state: createSeedState() };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: createSeedState(), warning: "浏览器禁用了本地存储，本次数据无法保存。" };
  }
  if (!raw) return { state: createSeedState() };
  try {
    return { state: normalizeState(JSON.parse(raw)) };
  } catch {
    return {
      state: createSeedState(),
      warning: "本地数据解析失败，已载入演示数据。原数据仍保留在浏览器中。"
    };
  }
};

export const saveState = (state: AppState): { ok: boolean; error?: string } => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return {
      ok: false,
      error:
        name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED"
          ? "本地存储空间不足，请先导出备份并清理数据。"
          : "本地保存失败，请检查浏览器存储权限。"
    };
  }
};

export const resetState = (): AppState => {
  const state = createSeedState();
  saveState(state);
  return state;
};

export const storageUsage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
};
