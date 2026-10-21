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
import { getRootIdForBank, bankPathLabel } from "../lib/banks";
import { updateWrongAfterAnswer } from "../lib/quiz";
import { makeFingerprint, uid } from "../lib/text";

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

/** 只保留指定题目相关的答案映射。 */
const pickByKeys = <T,>(record: Record<string, T>, ids: string[]) => {
  const allowed = new Set(ids);
  return Object.fromEntries(Object.entries(record).filter(([key]) => allowed.has(key)));
};

const clampIndex = (index: number, length: number) => Math.min(Math.max(0, length - 1), Math.max(0, index));

/**
 * 从状态中彻底移除题目，并同步清理作答、错题、笔记、考试与练习引用。
 * 删除题库、删除单题与清空回收站共用同一套逻辑。
 */
const detachQuestions = (state: AppState, removed: Set<string>): AppState => {
  if (!removed.size) return state;

  let practiceSession = state.practiceSession;
  if (practiceSession) {
    const currentId = practiceSession.questionIds[practiceSession.currentIndex];
    const questionIds = practiceSession.questionIds.filter((id) => !removed.has(id));
    if (!questionIds.length) {
      practiceSession = null;
    } else if (questionIds.length !== practiceSession.questionIds.length) {
      const currentIndex = currentId ? questionIds.indexOf(currentId) : -1;
      practiceSession = {
        ...practiceSession,
        questionIds,
        currentIndex: currentIndex >= 0 ? currentIndex : clampIndex(practiceSession.currentIndex, questionIds.length),
        answers: pickByKeys(practiceSession.answers, questionIds),
        submitted: pickByKeys(practiceSession.submitted, questionIds)
      };
    }
  }

  return {
    ...state,
    questions: state.questions.filter((question) => !removed.has(question.id)),
    records: state.records.filter((record) => !removed.has(record.questionId)),
    wrongs: state.wrongs.filter((wrong) => !removed.has(wrong.questionId)),
    notes: state.notes.filter((note) => !removed.has(note.questionId)),
    examSessions: state.examSessions
      .map((session) => {
        const questionIds = session.questionIds.filter((id) => !removed.has(id));
        if (questionIds.length === session.questionIds.length) return session;
        return {
          ...session,
          questionIds,
          answers: pickByKeys(session.answers, questionIds),
          marked: session.marked.filter((id) => !removed.has(id)),
          currentIndex: clampIndex(session.currentIndex ?? 0, questionIds.length)
        };
      })
      .filter((session) => session.questionIds.length > 0),
    practiceSession
  };
};

const stripBankFromExams = (state: AppState, removedBankIds: Set<string>): AppState => ({
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

const questionIdsInBanks = (state: AppState, bankIds: Set<string>) =>
  new Set(
    state.questions
      .filter((question) => bankIds.has(question.bankId) || bankIds.has(question.rootBankId))
      .map((question) => question.id)
  );

/** 真正删除题库子树及其作答、错题、笔记、考试引用；仅用于“彻底删除”与清空回收站。 */
const removeBankData = (state: AppState, removed: Set<string>): AppState => {
  const removedQuestions = questionIdsInBanks(state, removed);
  const next = detachQuestions(
    { ...state, banks: state.banks.filter((bank) => !removed.has(bank.id)) },
    removedQuestions
  );
  return stripBankFromExams(next, removed);
};

export const upsertBank = (state: AppState, draft: BankDraft, bankId?: string): AppState => {
  const stamp = nowIso();
  const name = draft.name.trim();
  if (bankId) {
    return {
      ...state,
      banks: state.banks.map((bank) =>
        bank.id === bankId
          ? {
              ...bank,
              name: name || bank.name,
              description: draft.description.trim(),
              parentId: draft.parentId || undefined,
              color: draft.color,
              updatedAt: stamp
            }
          : bank
      )
    };
  }
  const parentId = draft.parentId || undefined;
  const bank: QuestionBank = {
    id: uid("bank"),
    name,
    description: draft.description.trim() || "自建题库",
    parentId,
    sortIndex: state.banks.filter((item) => item.parentId === parentId).length + 1,
    color: draft.color,
    createdAt: stamp,
    updatedAt: stamp
  };
  return { ...state, banks: [...state.banks, bank] };
};

export const deleteBank = (state: AppState, catalog: Catalog, bankId: string): AppState => {
  const bank = catalog.bankById.get(bankId);
  if (!bank || bank.deletedAt) return state;
  const removed = collectSubtreeIds(state.banks, bankId);
  const removedQuestions = questionIdsInBanks(state, removed);
  const stamp = nowIso();
  const entry: TrashEntry = {
    id: uid("trash"),
    kind: "bank",
    bankId,
    bankName: bankPathLabel(state.banks, bankId),
    createdAt: stamp,
    bankCount: removed.size,
    questionCount: removedQuestions.size
  };
  const practiceSession = state.practiceSession
    ? (() => {
        const currentId = state.practiceSession!.questionIds[state.practiceSession!.currentIndex];
        const questionIds = state.practiceSession!.questionIds.filter((id) => !removedQuestions.has(id));
        const currentIndex = currentId ? questionIds.indexOf(currentId) : -1;
        return {
          ...state.practiceSession!,
          questionIds,
          answers: pickByKeys(state.practiceSession!.answers, questionIds),
          submitted: pickByKeys(state.practiceSession!.submitted, questionIds),
          currentIndex: currentIndex >= 0 ? currentIndex : clampIndex(state.practiceSession!.currentIndex, questionIds.length)
        };
      })()
    : null;
  return {
    ...state,
    banks: state.banks.map((item) => (removed.has(item.id) ? { ...item, deletedAt: stamp, updatedAt: stamp } : item)),
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
      sourceIds.has(bank.id) ? { ...bank, archived: undefined, deletedAt: undefined, updatedAt: stamp } : bank
    ),
    questions: state.questions.map((question) => {
      const move = moves.get(question.id);
      if (!move || !knownBankIds.has(move.bankId)) return question;
      // 只撤销仍停留在目标题库的题目；用户后来手动移到别处的题目保持不动。
      if (entry.targetBankId && question.bankId !== entry.targetBankId) return question;
      return { ...question, bankId: move.bankId, rootBankId: move.rootBankId, updatedAt: stamp };
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
  const rootBankId = getRootIdForBank(state.banks, bank.id);
  const stamp = nowIso();
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
              updatedAt: stamp,
              fingerprint
            }
          : question
      )
    };
  }

  const question: Question = {
    id: uid("q"),
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
    createdAt: stamp,
    updatedAt: stamp,
    fingerprint
  };
  return { ...state, questions: [...state.questions, question] };
};

export const deleteQuestion = (state: AppState, questionId: string): AppState =>
  detachQuestions(state, new Set([questionId]));

export const updateWrongStatus = (state: AppState, questionId: string, status: WrongStatus): AppState => {
  const stamp = nowIso();
  const nextReviewAt = status === "mastered" ? addDaysIso(stamp, 30) : stamp;
  return {
    ...state,
    wrongs: state.wrongs.map((wrong) =>
      wrong.questionId === questionId ? { ...wrong, status, nextReviewAt } : wrong
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
    id: uid("trash"),
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
    banks: state.banks.map((bank) => (sourceIds.has(bank.id) ? { ...bank, archived: true, updatedAt: stamp } : bank)),
    questions: state.questions.map((question) =>
      movedIds.has(question.id) ? { ...question, bankId: toId, rootBankId: targetRoot, updatedAt: stamp } : question
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

export const clearPractice = (state: AppState): AppState => ({ ...state, practiceSession: null });

/** 清空学习记录，但保留题库与考试策略。 */
export const clearStudyRecords = (state: AppState): AppState => ({
  ...state,
  records: [],
  wrongs: [],
  notes: [],
  examSessions: [],
  practiceSession: null
});

export const updateExamSession = (
  state: AppState,
  sessionId: string,
  updater: (session: ExamSession) => ExamSession
): AppState => ({
  ...state,
  examSessions: state.examSessions.map((session) => (session.id === sessionId ? updater(session) : session))
});
