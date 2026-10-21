import type { PracticeMode, PracticeSessionState } from "../types";
import { nowIso } from "./date";
import { uid } from "./text";

/** 创建一组练习会话；页面只负责选择题目与跳转。 */
export const createPracticeSession = (questionIds: string[], mode: PracticeMode): PracticeSessionState => {
  const startedAt = nowIso();
  return {
    id: uid("practice"),
    mode,
    questionIds,
    currentIndex: 0,
    answers: {},
    submitted: {},
    startedAt,
    questionStartedAt: startedAt
  };
};
