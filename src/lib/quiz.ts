import type {
  AppState,
  Question,
  QuestionEvaluation,
  WrongQuestion
} from "../types";
import { addDaysIso, daysSince, nowIso } from "./date";
import { normalizeAnswerToken, uid } from "./text";

/**
 * 判题：选择题比较集合，填空题逐空比较并支持等价答案。
 * 使用 NFKC 归一化，兼容全角字母、全角数字和常见判断同义词。
 */
export const evaluateQuestion = (question: Question, answer: string[]): QuestionEvaluation => {
  const normalizedUserAnswer = answer.map(normalizeAnswerToken).filter(Boolean);
  const normalizedAnswer = question.answer.map(normalizeAnswerToken).filter(Boolean);

  if (question.type === "fill") {
    const isCorrect =
      normalizedAnswer.length > 0 &&
      normalizedAnswer.length === normalizedUserAnswer.length &&
      normalizedAnswer.every((expected, index) => {
        const aliases = (question.answerAliases[index] ?? []).map(normalizeAnswerToken).filter(Boolean);
        return [expected, ...aliases].includes(normalizedUserAnswer[index]);
      });
    return {
      isCorrect,
      normalizedUserAnswer,
      normalizedAnswer,
      detail: isCorrect ? "填空答案匹配" : "填空答案与标准答案不一致"
    };
  }

  const sortedUser = [...new Set(normalizedUserAnswer)].sort();
  const sortedExpected = [...new Set(normalizedAnswer)].sort();
  const isCorrect =
    sortedExpected.length > 0 &&
    sortedUser.length === sortedExpected.length &&
    sortedExpected.every((item, index) => item === sortedUser[index]);

  return {
    isCorrect,
    normalizedUserAnswer: sortedUser,
    normalizedAnswer: sortedExpected,
    detail: isCorrect ? "答案完全一致" : "答案不一致"
  };
};

/** 部分 Fisher–Yates：只洗前 count 个位置，大题库下比整体 shuffle 更快。 */
export const sampleQuestions = <T,>(items: T[], count: number) => {
  const target = Math.max(0, Math.min(Math.floor(count), items.length));
  const copy = [...items];
  for (let index = 0; index < target; index += 1) {
    const swap = index + Math.floor(Math.random() * (copy.length - index));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, target);
};

export const shuffle = <T,>(items: T[]) => sampleQuestions(items, items.length);

export interface WeightOptions {
  wrongStrength: number;
  knowledgeStrength: number;
}

/**
 * 加权抽样（不放回）。
 *
 * 使用 Efraimidis–Spirakis 的指数键方法：key = random^(1/weight)，
 * 取 key 最大的前 k 项，结果等价于按权重逐个抽取但复杂度为 O(n log n)。
 * 旧实现的 O(n²) 在几千题、几百抽时会明显卡顿。
 */
export const weightedSampleQuestions = (
  pool: Question[],
  count: number,
  params: {
    wrongById: Map<string, WrongQuestion>;
    knowledgeRates: Map<string, number>;
    lastPracticedAt: Map<string, string>;
    options: WeightOptions;
  }
) => {
  const { wrongById, knowledgeRates, lastPracticedAt, options } = params;
  const target = Math.max(0, Math.min(Math.floor(count), pool.length));
  if (!target) return [];

  const scored = pool.map((question) => {
    const wrong = wrongById.get(question.id);
    const knowledgeRate = Math.max(
      0,
      ...question.knowledgePoints.map((point) => knowledgeRates.get(point) ?? 0)
    );
    const days = daysSince(lastPracticedAt.get(question.id));
    const recentPenalty = days < 1 ? 3 : 0;
    const weight = Math.max(
      0.2,
      1 +
        Math.min((wrong?.wrongCount ?? 0) * options.wrongStrength, 12) +
        knowledgeRate * options.knowledgeStrength * 2 +
        Math.min(days / 7, 5) -
        (wrong?.masteryLevel ?? 0) * 0.8 -
        recentPenalty
    );
    const key = Math.pow(Math.random(), 1 / weight);
    return { question, key };
  });

  scored.sort((a, b) => b.key - a.key);
  return scored.slice(0, target).map((item) => item.question);
};

/**
 * 作答后更新错题掌握度：
 * 连续答对 3 次或掌握度到 4 视为掌握；答错则清零并安排次日复习。
 */
export const updateWrongAfterAnswer = (
  wrongs: WrongQuestion[],
  questionId: string,
  isCorrect: boolean,
  answeredAt: string
): WrongQuestion[] => {
  const existing = wrongs.find((wrong) => wrong.questionId === questionId);
  if (!existing && isCorrect) return wrongs;
  const others = wrongs.filter((wrong) => wrong.questionId !== questionId);

  if (!existing) {
    return [
      ...others,
      {
        questionId,
        wrongCount: 1,
        correctAfterWrongCount: 0,
        lastWrongAt: answeredAt,
        masteryLevel: 0,
        wrongReasons: [],
        status: "active",
        nextReviewAt: answeredAt
      }
    ];
  }

  if (isCorrect) {
    const correctAfterWrongCount = existing.correctAfterWrongCount + 1;
    const masteryLevel = Math.min(5, existing.masteryLevel + 1);
    const mastered = correctAfterWrongCount >= 3 || masteryLevel >= 4;
    return [
      ...others,
      {
        ...existing,
        correctAfterWrongCount,
        masteryLevel,
        lastCorrectAt: answeredAt,
        status: mastered ? "mastered" : "active",
        nextReviewAt: addDaysIso(answeredAt, mastered ? 30 : correctAfterWrongCount * 3)
      }
    ];
  }

  return [
    ...others,
    {
      ...existing,
      wrongCount: existing.wrongCount + 1,
      correctAfterWrongCount: 0,
      lastWrongAt: answeredAt,
      masteryLevel: 0,
      status: "active",
      nextReviewAt: addDaysIso(answeredAt, 1)
    }
  ];
};

export const isPracticeFinished = (session: NonNullable<AppState["practiceSession"]>) =>
  Boolean(session.completedAt) || session.currentIndex >= session.questionIds.length;

export const createStudyRecord = (
  question: Question,
  sessionId: string,
  mode: "sequence" | "random" | "weighted" | "wrong" | "exam",
  userAnswer: string[],
  score: number,
  timeSpentMs: number
) => {
  const answeredAt = nowIso();
  const evaluation = evaluateQuestion(question, userAnswer);
  return {
    record: {
      id: uid("record"),
      questionId: question.id,
      sessionId,
      mode,
      userAnswer,
      isCorrect: evaluation.isCorrect,
      score,
      timeSpentMs: Math.max(0, timeSpentMs),
      answeredAt
    },
    evaluation,
    answeredAt
  } as const;
};
