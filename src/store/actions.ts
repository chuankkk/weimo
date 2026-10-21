import type {
  AppState,
  ExamSession,
  PracticeSessionState,
  Question,
  QuestionBank,
  WrongStatus
} from "../types";
import type { Catalog } from "../lib/catalog";
import { addDaysIso, nowIso } from "../lib/date";
import { updateWrongAfterAnswer } from "../lib/quiz";
import { makeFingerprint } from "../lib/text";

export interface BankDraft {
  name: string;
  description: string;
  parentId?: string;
  color: string;
}

export interface QuestionDraft {
  id?: string;
  bankId: string;
  type: Question["type"];
  stem: string;
  options: Question["options"];
  answer: string[];
  answerAliases: string[][];
  explanation: string;
  knowledgePoints: string[];
  tags: string[];
  difficulty: number;
  source: string;
}

const stripBankFromExams = (state: AppState, removedBankIds: Set<string>) => ({
  ...state,
  exams: state.exams.map((exam) => ({
    ...exam,
    blueprint: exam.blueprint.filter((item) => !removedBankIds.has(item.bankId))
  }))
});

export const upsertBank = (state: AppState, draft: BankDraft, bankId?: string): AppState => {
  const createdAt = nowIso();
  if (bankId) {
    return {
      ...state,
      banks: state.banks.map((bank) =>
        bank.id === bankId
          ? {
              ...bank,
              name: draft.name.trim() || bank.name,
              description: draft.description.trim(),
              parentId: draft.parentId || undefined,
              color: draft.color,
              updatedAt: createdAt
            }
          : bank
      )
    };
  }
  const parentId = draft.parentId || undefined;
  const bank: QuestionBank = {
    id: `bank-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: draft.name.trim(),
    description: draft.description.trim() || "自建题库",
    parentId,
    sortIndex: state.banks.filter((item) => item.parentId === parentId).length + 1,
    color: draft.color,
    createdAt,
    updatedAt: createdAt
  };
  return { ...state, banks: [...state.banks, bank] };
};

export const deleteBank = (state: AppState, catalog: Catalog, bankId: string): AppState => {
  const removed = new Set(catalog.subtreeIds(bankId));
  const removedQuestions = new Set(
    state.questions.filter((question) => removed.has(question.bankId) || removed.has(question.rootBankId)).map((question) => question.id)
  );
  const questions = state.questions.filter((question) => !removedQuestions.has(question.id));
  const next: AppState = {
    ...state,
    banks: state.banks.filter((bank) => !removed.has(bank.id)),
    questions,
    records: state.records.filter((record) => !removedQuestions.has(record.questionId)),
    wrongs: state.wrongs.filter((wrong) => !removedQuestions.has(wrong.questionId)),
    notes: state.notes.filter((note) => !removedQuestions.has(note.questionId)),
    examSessions: state.examSessions
      .map((session) => {
        const questionIds = session.questionIds.filter((id) => !removedQuestions.has(id));
        const answers = Object.fromEntries(Object.entries(session.answers).filter(([id]) => !removedQuestions.has(id)));
        const marked = session.marked.filter((id) => !removedQuestions.has(id));
        return { ...session, questionIds, answers, marked };
      })
      .filter((session) => session.questionIds.length > 0),
    practiceSession:
      state.practiceSession && state.practiceSession.questionIds.some((id) => !removedQuestions.has(id))
        ? {
            ...state.practiceSession,
            questionIds: state.practiceSession.questionIds.filter((id) => !removedQuestions.has(id)),
            currentIndex: 0
          }
        : null
  };
  return stripBankFromExams(next, removed);
};

export const upsertQuestion = (state: AppState, draft: QuestionDraft): AppState => {
  const bank = state.banks.find((item) => item.id === draft.bankId);
  if (!bank) return state;
  const rootBankId = state.banks.find((item) => item.id === bank.parentId)?.id ?? bank.id;
  const now = nowIso();
  const fingerprint = makeFingerprint(draft.stem, draft.options, draft.answer);

  if (draft.id) {
    return {
      ...state,
      questions: state.questions.map((question) =>
        question.id === draft.id
          ? {
              ...question,
              bankId: draft.bankId,
              rootBankId,
              type: draft.type,
              stem: draft.stem,
              options: draft.options,
              answer: draft.answer,
              answerAliases: draft.answerAliases,
              explanation: draft.explanation,
              knowledgePoints: draft.knowledgePoints,
              tags: draft.tags,
              difficulty: draft.difficulty,
              source: draft.source,
              updatedAt: now,
              fingerprint
            }
          : question
      )
    };
  }

  const question: Question = {
    id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    bankId: draft.bankId,
    rootBankId,
    type: draft.type,
    stem: draft.stem,
    options: draft.options,
    answer: draft.answer,
    answerAliases: draft.answerAliases,
    explanation: draft.explanation,
    knowledgePoints: draft.knowledgePoints,
    tags: draft.tags,
    difficulty: draft.difficulty,
    source: draft.source,
    sortIndex: state.questions.filter((item) => item.bankId === draft.bankId).length + 1,
    createdAt: now,
    updatedAt: now,
    fingerprint
  };
  return { ...state, questions: [...state.questions, question] };
};

export const deleteQuestion = (state: AppState, questionId: string): AppState => {
  const next: AppState = {
    ...state,
    questions: state.questions.filter((question) => question.id !== questionId),
    records: state.records.filter((record) => record.questionId !== questionId),
    wrongs: state.wrongs.filter((wrong) => wrong.questionId !== questionId),
    notes: state.notes.filter((note) => note.questionId !== questionId),
    examSessions: state.examSessions
      .map((session) => {
        if (!session.questionIds.includes(questionId)) return session;
        const answers = { ...session.answers };
        delete answers[questionId];
        return {
          ...session,
          questionIds: session.questionIds.filter((id) => id !== questionId),
          answers,
          marked: session.marked.filter((id) => id !== questionId)
        };
      })
      .filter((session) => session.questionIds.length > 0),
    practiceSession: state.practiceSession
      ? {
          ...state.practiceSession,
          questionIds: state.practiceSession.questionIds.filter((id) => id !== questionId),
          currentIndex: 0
        }
      : null
  };
  if (next.practiceSession && !next.practiceSession.questionIds.length) next.practiceSession = null;
  return next;
};

export const updateWrongStatus = (state: AppState, questionId: string, status: WrongStatus): AppState => {
  const answeredAt = nowIso();
  return {
    ...state,
    wrongs: state.wrongs.map((wrong) =>
      wrong.questionId === questionId
        ? {
            ...wrong,
            status,
            nextReviewAt:
              status === "mastered" ? addDaysIso(answeredAt, 30) : status === "ignored" ? answeredAt : answeredAt
          }
        : wrong
    )
  };
};

export const mergeBanks = (state: AppState, catalog: Catalog, fromId: string, toId: string): AppState => {
  if (!fromId || !toId || fromId === toId) return state;
  const sourceIds = new Set(catalog.subtreeIds(fromId));
  // 禁止把父题库合并进自己的子题库，否则目标也会被归档。
  if (sourceIds.has(toId)) return state;
  const targetRoot = catalog.rootOf(toId);
  const stamp = nowIso();
  return {
    ...state,
    banks: state.banks.map((bank) =>
      sourceIds.has(bank.id) ? { ...bank, archived: true, updatedAt: stamp } : bank
    ),
    questions: state.questions.map((question) =>
      sourceIds.has(question.bankId) || sourceIds.has(question.rootBankId)
        ? { ...question, bankId: toId, rootBankId: targetRoot, updatedAt: stamp }
        : question
    )
  };
};

export const applyPracticeAnswer = (
  state: AppState,
  question: Question,
  session: PracticeSessionState,
  answer: string[],
  isCorrect: boolean,
  timeSpentMs: number,
  recordId: string,
  answeredAt: string
): AppState => ({
  ...state,
  records: [
    ...state.records,
    {
      id: recordId,
      questionId: question.id,
      sessionId: session.id,
      mode: session.mode,
      userAnswer: answer,
      isCorrect,
      score: isCorrect ? 1 : 0,
      timeSpentMs: Math.max(0, timeSpentMs),
      answeredAt
    }
  ],
  wrongs: updateWrongAfterAnswer(state.wrongs, question.id, isCorrect, answeredAt)
});

export const startOrReplacePractice = (state: AppState, session: PracticeSessionState): AppState => ({
  ...state,
  practiceSession: session
});

export const clearPractice = (state: AppState): AppState => ({ ...state, practiceSession: null });

export const updateExamSession = (
  state: AppState,
  sessionId: string,
  updater: (session: ExamSession) => ExamSession
): AppState => ({
  ...state,
  examSessions: state.examSessions.map((session) => (session.id === sessionId ? updater(session) : session))
});
