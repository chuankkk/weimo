import type {
  AppState,
  ExamSession,
  PracticeSessionState,
  Question,
  QuestionBank,
  TrashEntry,
  TrashMove,
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

/** 收集题库子树，包含已归档/已软删除的条目，供回收站恢复与彻底删除使用。 */
const collectSubtreeIds = (banks: QuestionBank[], rootId: string) => {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const bank of banks) {
      if (bank.parentId && ids.has(bank.parentId) && !ids.has(bank.id)) {
        ids.add(bank.id);
        changed = true;
      }
    }
  }
  return ids;
};

const bankPathLabel = (banks: QuestionBank[], bankId: string) => {
  const byId = new Map(banks.map((bank) => [bank.id, bank]));
  const path: string[] = [];
  let current = byId.get(bankId);
  let guard = 0;
  while (current && guard < 8) {
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }
  return path.join(" / ") || "未命名题库";
};

const makeTrashId = () => `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** 真正删除题库子树及其作答、错题、笔记、考试引用；仅用于“彻底删除”与清空回收站。 */
const removeBankData = (state: AppState, removed: Set<string>): AppState => {
  const removedQuestions = new Set(
    state.questions
      .filter((question) => removed.has(question.bankId) || removed.has(question.rootBankId))
      .map((question) => question.id)
  );
  const next: AppState = {
    ...state,
    banks: state.banks.filter((bank) => !removed.has(bank.id)),
    questions: state.questions.filter((question) => !removedQuestions.has(question.id)),
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
  const bank = catalog.bankById.get(bankId);
  if (!bank || bank.deletedAt) return state;
  const removed = collectSubtreeIds(state.banks, bankId);
  const removedQuestions = new Set(
    state.questions
      .filter((question) => removed.has(question.bankId) || removed.has(question.rootBankId))
      .map((question) => question.id)
  );
  const stamp = nowIso();
  const entry: TrashEntry = {
    id: makeTrashId(),
    kind: "bank",
    bankId,
    bankName: bankPathLabel(state.banks, bankId),
    createdAt: stamp,
    bankCount: removed.size,
    questionCount: removedQuestions.size
  };
  const practiceSession = state.practiceSession
    ? {
        ...state.practiceSession,
        questionIds: state.practiceSession.questionIds.filter((id) => !removedQuestions.has(id)),
        answers: Object.fromEntries(
          Object.entries(state.practiceSession.answers).filter(([id]) => !removedQuestions.has(id))
        ),
        submitted: Object.fromEntries(
          Object.entries(state.practiceSession.submitted).filter(([id]) => !removedQuestions.has(id))
        ),
        currentIndex: 0
      }
    : null;
  return {
    ...state,
    banks: state.banks.map((item) =>
      removed.has(item.id) ? { ...item, deletedAt: stamp, updatedAt: stamp } : item
    ),
    practiceSession: practiceSession && practiceSession.questionIds.length ? practiceSession : null,
    trash: [entry, ...state.trash.filter((item) => !removed.has(item.bankId))]
  };
};

export const restoreTrashEntry = (state: AppState, entryId: string): AppState => {
  const entry = state.trash.find((item) => item.id === entryId);
  if (!entry) return state;
  const stamp = nowIso();

  if (entry.kind === "bank") {
    if (!state.banks.some((bank) => bank.id === entry.bankId)) {
      return { ...state, trash: state.trash.filter((item) => item.id !== entry.id) };
    }
    const restored = collectSubtreeIds(state.banks, entry.bankId);
    return {
      ...state,
      banks: state.banks.map((bank) =>
        restored.has(bank.id) ? { ...bank, deletedAt: undefined, updatedAt: stamp } : bank
      ),
      trash: state.trash.filter((item) => item.id !== entry.id)
    };
  }

  if (!state.banks.some((bank) => bank.id === entry.bankId)) {
    return { ...state, trash: state.trash.filter((item) => item.id !== entry.id) };
  }
  const sourceIds = collectSubtreeIds(state.banks, entry.bankId);
  const moves = new Map((entry.moves ?? []).map((move) => [move.questionId, move]));
  const knownBankIds = new Set(state.banks.map((bank) => bank.id));
  return {
    ...state,
    banks: state.banks.map((bank) =>
      sourceIds.has(bank.id)
        ? { ...bank, archived: undefined, deletedAt: undefined, updatedAt: stamp }
        : bank
    ),
    questions: state.questions.map((question) => {
      const move = moves.get(question.id);
      if (!move || !knownBankIds.has(move.bankId)) return question;
      // 只撤销仍停留在目标题库的题目；用户后来手动移到别处的题目保持不动。
      if (entry.targetBankId && question.bankId !== entry.targetBankId) return question;
      return {
        ...question,
        bankId: move.bankId,
        rootBankId: move.rootBankId,
        updatedAt: stamp
      };
    }),
    trash: state.trash.filter((item) => item.id !== entry.id)
  };
};

export const purgeTrashEntry = (state: AppState, entryId: string): AppState => {
  const entry = state.trash.find((item) => item.id === entryId);
  if (!entry) return state;
  const removed = collectSubtreeIds(state.banks, entry.bankId);
  const next = removeBankData(state, removed);
  return {
    ...next,
    trash: next.trash.filter((item) => item.id !== entry.id && !removed.has(item.bankId))
  };
};

export const emptyTrash = (state: AppState): AppState =>
  state.trash.reduce((current, entry) => purgeTrashEntry(current, entry.id), state);

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
  const fromBank = catalog.bankById.get(fromId);
  const toBank = catalog.bankById.get(toId);
  if (!fromBank || !toBank) return state;
  const moves: TrashMove[] = state.questions
    .filter((question) => sourceIds.has(question.bankId) || sourceIds.has(question.rootBankId))
    .map((question) => ({
      questionId: question.id,
      bankId: question.bankId,
      rootBankId: question.rootBankId
    }));
  if (!moves.length) return state;
  const movedIds = new Set(moves.map((move) => move.questionId));
  const stamp = nowIso();
  const entry: TrashEntry = {
    id: makeTrashId(),
    kind: "merge",
    bankId: fromId,
    bankName: bankPathLabel(state.banks, fromId),
    targetBankId: toId,
    targetBankName: bankPathLabel(state.banks, toId),
    createdAt: stamp,
    bankCount: sourceIds.size,
    questionCount: moves.length,
    moves
  };
  return {
    ...state,
    banks: state.banks.map((bank) =>
      sourceIds.has(bank.id) ? { ...bank, archived: true, updatedAt: stamp } : bank
    ),
    questions: state.questions.map((question) =>
      movedIds.has(question.id)
        ? { ...question, bankId: toId, rootBankId: targetRoot, updatedAt: stamp }
        : question
    ),
    trash: [entry, ...state.trash.filter((item) => !(item.kind === "merge" && item.bankId === fromId))]
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
