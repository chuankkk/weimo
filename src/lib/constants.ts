import type { PracticeMode, QuestionType } from "../types";

export const STORAGE_KEY = "shuati-wang-state-v1";
export const SCHEMA_VERSION = 2;

export const TYPE_ORDER: QuestionType[] = ["single", "multiple", "judge", "fill"];

export const typeLabel: Record<QuestionType, string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
  fill: "填空"
};

export const typeTone: Record<QuestionType, "jade" | "blue" | "gold" | "rose"> = {
  single: "jade",
  multiple: "blue",
  judge: "gold",
  fill: "rose"
};

export const typeDescription: Record<QuestionType, string> = {
  single: "四个选项中只有一个是正确答案",
  multiple: "答案可能包含多个选项",
  judge: "判断陈述正确或错误",
  fill: "按空填写答案，支持等价答案"
};

export const modeLabel: Record<PracticeMode, string> = {
  sequence: "顺序刷题",
  random: "随机刷题",
  weighted: "智能随机",
  wrong: "错题重刷"
};

export const modeDescription: Record<PracticeMode, string> = {
  sequence: "按题库排序稳步推进，适合系统过一遍",
  random: "从所选范围随机抽题，避免形成固定顺序",
  weighted: "错题、薄弱知识点与久未练习的题优先出现",
  wrong: "只从活跃错题中抽取，集中攻克薄弱环节"
};

export const modeHint: Record<PracticeMode, string> = {
  sequence: "稳定推进",
  random: "混合抽题",
  weighted: "弱项加权",
  wrong: "错题回流"
};

export const BANK_COLORS = ["#2C4B43", "#455D73", "#8B6833", "#7B5C63", "#556B4F", "#7A5547"];

export const DEFAULT_SCORE_PER_TYPE: Record<QuestionType, number> = {
  single: 1,
  multiple: 2,
  judge: 1,
  fill: 2
};

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "入门",
  2: "基础",
  3: "进阶",
  4: "较难",
  5: "挑战"
};

export const MIN_BANK_COUNT = 1;

export const APP_NAME = "闱墨";
export const APP_SLOGAN = "一卷一答，墨见真知";
export const APP_VERSION = "2.1.0";

export const ALL_TYPES: QuestionType[] = [...TYPE_ORDER];
