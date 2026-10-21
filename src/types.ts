/**
 * 闱墨 · 领域模型
 *
 * 说明：字段名与 v1 本地存储保持兼容，新增字段全部可选，
 * 由 storage 层的 normalizeState 补齐，避免旧备份无法导入。
 */

export type QuestionType = "single" | "multiple" | "judge" | "fill";
export type PracticeMode = "sequence" | "random" | "weighted" | "wrong";
export type TabKey = "home" | "banks" | "practice" | "wrong" | "exam" | "settings";
export type ThemeMode = "light" | "dark" | "system";
export type WrongStatus = "active" | "mastered" | "ignored";
export type ExamStatus = "running" | "submitted" | "timeout";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  sortIndex: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  /** 软删除：仍在本地数据中，可在回收站恢复。 */
  deletedAt?: string;
}

export interface TrashMove {
  questionId: string;
  bankId: string;
  rootBankId: string;
}

export interface TrashEntry {
  id: string;
  kind: "bank" | "merge";
  /** 被删除的题库，或合并操作的来源题库。 */
  bankId: string;
  bankName: string;
  createdAt: string;
  bankCount: number;
  questionCount: number;
  targetBankId?: string;
  targetBankName?: string;
  /** 合并时记录每道题的原始归属，用于撤销合并。 */
  moves?: TrashMove[];
}

export interface Question {
  id: string;
  bankId: string;
  rootBankId: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  answer: string[];
  answerAliases: string[][];
  explanation: string;
  knowledgePoints: string[];
  tags: string[];
  difficulty: number;
  source: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
  fingerprint: string;
}

export interface PracticeRecord {
  id: string;
  questionId: string;
  sessionId: string;
  mode: PracticeMode | "exam";
  userAnswer: string[];
  isCorrect: boolean;
  score: number;
  timeSpentMs: number;
  answeredAt: string;
}

export interface WrongQuestion {
  questionId: string;
  wrongCount: number;
  correctAfterWrongCount: number;
  lastWrongAt: string;
  lastCorrectAt?: string;
  masteryLevel: number;
  wrongReasons: string[];
  status: WrongStatus;
  nextReviewAt: string;
}

export interface UserNote {
  id: string;
  questionId: string;
  content: string;
  updatedAt: string;
}

export interface ExamBlueprintItem {
  bankId: string;
  single: number;
  multiple: number;
  judge: number;
  fill: number;
}

export interface ExamTemplate {
  id: string;
  name: string;
  durationMinutes: number;
  blueprint: ExamBlueprintItem[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  scorePerType: Record<QuestionType, number>;
  createdAt: string;
}

export interface ExamSession {
  id: string;
  templateId: string;
  name: string;
  questionIds: string[];
  answers: Record<string, string[]>;
  marked: string[];
  startedAt: string;
  submittedAt?: string;
  durationMinutes: number;
  status: ExamStatus;
  score: number;
  /** 断点续考：上次停留的题号 */
  currentIndex?: number;
}

export interface PracticeSessionState {
  id: string;
  mode: PracticeMode;
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, string[]>;
  submitted: Record<string, boolean>;
  startedAt: string;
  /** 当前题开始作答的时间，用于单题耗时统计 */
  questionStartedAt?: string;
  completedAt?: string;
}

export interface Settings {
  theme: ThemeMode;
  autoNext: boolean;
  weightedWrongStrength: number;
  weightedKnowledgeStrength: number;
  reviewDailyTarget: number;
}

export interface AppState {
  schemaVersion?: number;
  banks: QuestionBank[];
  questions: Question[];
  records: PracticeRecord[];
  wrongs: WrongQuestion[];
  notes: UserNote[];
  exams: ExamTemplate[];
  examSessions: ExamSession[];
  practiceSession?: PracticeSessionState | null;
  settings: Settings;
  /** 回收站：软删除的题库与可撤销的合并操作。 */
  trash: TrashEntry[];
}

export interface QuestionEvaluation {
  isCorrect: boolean;
  normalizedUserAnswer: string[];
  normalizedAnswer: string[];
  detail: string;
}

export interface WrongRow {
  wrong: WrongQuestion;
  question: Question;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}
