import type { Question, QuestionOption, QuestionType } from "../types";

export const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 组合 className，过滤空值。 */
export const cn = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" ");

/** 全角转半角、空白收敛、统一标点的比较文本。 */
export const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[，、]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[；]/g, ";")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase();

const TRUE_WORDS = ["对", "正确", "true", "t", "yes", "y", "是", "√", "对的"];
const FALSE_WORDS = ["错", "错误", "false", "f", "no", "n", "否", "×", "x", "错的"];

export const normalizeAnswerToken = (value: string) => {
  const text = normalizeText(value);
  if (TRUE_WORDS.includes(text)) return "true";
  if (FALSE_WORDS.includes(text)) return "false";
  return text.toUpperCase();
};

export const makeFingerprint = (stem: string, options: QuestionOption[], answer: string[]) =>
  normalizeText(`${stem}|${options.map((option) => `${option.key}:${option.text}`).join("|")}|${answer.join(",")}`);

/** 把 "A,B,,C" / "A、B、C" 一类的答案文本拆成 token。 */
export const splitAnswerTokens = (raw: string) =>
  raw
    .split(/[,，、\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

export const splitList = (raw: string) =>
  raw
    .split(/[;；,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const parseAliasesText = (raw: string) => {
  if (!raw.trim()) return [];
  return raw
    .split(/[;；]/)
    .map((part) => part.split("|").map((item) => item.trim()).filter(Boolean))
    .filter((part) => part.length > 0);
};

export const parseAnswerText = (questionType: QuestionType, raw: string) => {
  if (questionType === "fill") return raw.split(/[;；]/).map((item) => item.trim());
  if (questionType === "judge") return [normalizeAnswerToken(raw)];
  return splitAnswerTokens(raw);
};

export const isTrueToken = (value?: string) => normalizeAnswerToken(value ?? "") === "true";

/** 题干中连续下划线（或全角下划线）代表一个空。 */
export const countBlanks = (stem: string) => {
  const matches = stem.match(/[_＿]{2,}/g);
  return matches?.length ?? 0;
};

export const resolveBlankCount = (question: Question) =>
  Math.max(question.answer.length, countBlanks(question.stem), 1);

export const formatAnswer = (question: Question) => {
  if (question.type === "judge") return isTrueToken(question.answer[0]) ? "正确" : "错误";
  if (question.type === "fill") return question.answer.map((item, index) => `第 ${index + 1} 空：${item}`).join("；");
  return question.answer.join("、");
};

export const formatUserAnswer = (question: Question, answer: string[]) => {
  if (!answer.length) return "未作答";
  if (question.type === "judge") return isTrueToken(answer[0]) ? "正确" : "错误";
  if (question.type === "fill") return answer.map((item, index) => `第 ${index + 1} 空：${item || "（空）"}`).join("；");
  return answer.join("、");
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const estimateMinutes = (count: number, secondsPerQuestion = 45) =>
  Math.max(1, Math.round((count * secondsPerQuestion) / 60));
