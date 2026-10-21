import type { Question, QuestionBank, QuestionType } from "../types";
import { TYPE_ORDER } from "./constants";

const compareQuestions = (a: Question, b: Question) =>
  a.sortIndex - b.sortIndex || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const compareBanks = (a: QuestionBank, b: QuestionBank) =>
  a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);

export interface Catalog {
  banks: QuestionBank[];
  questions: Question[];
  bankById: Map<string, QuestionBank>;
  questionById: Map<string, Question>;
  /** 未归档的一级题库 */
  roots: QuestionBank[];
  /** 未归档的全部题库 */
  visibleBanks: QuestionBank[];
  childrenOf: (bankId: string) => QuestionBank[];
  subtreeIds: (bankId: string) => string[];
  rootOf: (bankId: string) => string;
  bankName: (bankId: string) => string;
  bankPath: (bankId: string) => QuestionBank[];
  pool: (bankId: string, types?: QuestionType[]) => Question[];
  typeCounts: (bankId: string) => Record<QuestionType, number>;
  totalIn: (bankId: string) => number;
  isRoot: (bankId: string) => boolean;
}

/**
 * 一次性建立题库/题目索引。
 * 题库与题目变化时才重建；答题只改变 records/wrongs，因此不会反复扫全量题目。
 */
export const createCatalog = (banks: QuestionBank[], questions: Question[]): Catalog => {
  const bankById = new Map(banks.map((bank) => [bank.id, bank]));
  const isVisibleBank = (bank: QuestionBank) => !bank.archived && !bank.deletedAt;
  const visibleBanks = banks.filter(isVisibleBank).sort(compareBanks);
  const visibleBankIds = new Set(visibleBanks.map((bank) => bank.id));
  const visibleQuestions = questions.filter(
    (question) => visibleBankIds.has(question.bankId) && visibleBankIds.has(question.rootBankId)
  );
  const questionById = new Map(visibleQuestions.map((question) => [question.id, question]));

  const childrenMap = new Map<string, QuestionBank[]>();
  for (const bank of banks) {
    if (!bank.parentId || !isVisibleBank(bank) || !visibleBankIds.has(bank.parentId)) continue;
    const list = childrenMap.get(bank.parentId) ?? [];
    list.push(bank);
    childrenMap.set(bank.parentId, list);
  }
  for (const list of childrenMap.values()) list.sort(compareBanks);

  const roots = visibleBanks.filter((bank) => !bank.parentId);

  const byBank = new Map<string, Question[]>();
  const byRoot = new Map<string, Question[]>();
  const sortedQuestions = [...visibleQuestions].sort(compareQuestions);
  for (const question of sortedQuestions) {
    if (question.bankId) {
      const list = byBank.get(question.bankId) ?? [];
      list.push(question);
      byBank.set(question.bankId, list);
    }
    if (question.rootBankId) {
      const list = byRoot.get(question.rootBankId) ?? [];
      list.push(question);
      byRoot.set(question.rootBankId, list);
    }
  }

  const subtreeCache = new Map<string, string[]>();
  const subtreeIds = (bankId: string): string[] => {
    const cached = subtreeCache.get(bankId);
    if (cached) return cached;
    const ids = [bankId];
    const walk = (id: string, depth: number) => {
      if (depth > 8) return;
      for (const child of childrenMap.get(id) ?? []) {
        ids.push(child.id);
        walk(child.id, depth + 1);
      }
    };
    walk(bankId, 0);
    subtreeCache.set(bankId, ids);
    return ids;
  };

  const poolCache = new Map<string, Question[]>();
  const basePool = (bankId: string): Question[] => {
    if (bankId === "all") return sortedQuestions;
    const bank = bankById.get(bankId);
    if (!bank) return [];
    if (!bank.parentId) {
      // 一级题库：以 rootBankId 聚合全部子库题目，同时兜底直接挂载的题目。
      const merged = new Map<string, Question>();
      for (const question of byRoot.get(bankId) ?? []) merged.set(question.id, question);
      for (const question of byBank.get(bankId) ?? []) merged.set(question.id, question);
      return [...merged.values()].sort(compareQuestions);
    }
    return byBank.get(bankId) ?? [];
  };

  const pool = (bankId: string, types: QuestionType[] = TYPE_ORDER): Question[] => {
    const list = basePool(bankId);
    if (!types.length) return [];
    if (types.length === TYPE_ORDER.length && TYPE_ORDER.every((type) => types.includes(type))) return list;
    const key = `${bankId}|${[...types].sort().join(",")}`;
    const cached = poolCache.get(key);
    if (cached) return cached;
    const filtered = list.filter((question) => types.includes(question.type));
    poolCache.set(key, filtered);
    return filtered;
  };

  const countsCache = new Map<string, Record<QuestionType, number>>();
  const typeCounts = (bankId: string) => {
    const cached = countsCache.get(bankId);
    if (cached) return cached;
    const counts: Record<QuestionType, number> = { single: 0, multiple: 0, judge: 0, fill: 0 };
    for (const question of basePool(bankId)) counts[question.type] += 1;
    countsCache.set(bankId, counts);
    return counts;
  };

  const rootOf = (bankId: string): string => {
    let current = bankById.get(bankId);
    let guard = 0;
    while (current?.parentId && guard < 8) {
      const parent = bankById.get(current.parentId);
      if (!parent) break;
      current = parent;
      guard += 1;
    }
    return current?.id ?? bankId;
  };

  const bankPath = (bankId: string) => {
    const path: QuestionBank[] = [];
    let current = bankById.get(bankId);
    let guard = 0;
    while (current && guard < 8) {
      path.unshift(current);
      current = current.parentId ? bankById.get(current.parentId) : undefined;
      guard += 1;
    }
    return path;
  };

  return {
    banks,
    questions: visibleQuestions,
    bankById,
    questionById,
    roots,
    visibleBanks,
    childrenOf: (bankId: string) => childrenMap.get(bankId) ?? [],
    subtreeIds,
    rootOf,
    bankName: (bankId: string) => bankById.get(bankId)?.name ?? "未知题库",
    bankPath,
    pool: (bankId: string, types?: QuestionType[]) => (types ? pool(bankId, types) : pool(bankId, TYPE_ORDER)),
    typeCounts,
    totalIn: (bankId: string) => basePool(bankId).length,
    isRoot: (bankId: string) => {
      const bank = bankById.get(bankId);
      return Boolean(bank && !bank.parentId);
    }
  };
};
