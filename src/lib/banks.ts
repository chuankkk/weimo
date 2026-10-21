import type { QuestionBank } from "../types";

/** 按排序号、名称排序题库。 */
export const sortedBanks = (banks: QuestionBank[]) =>
  [...banks].sort(
    (a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id)
  );

export const getRootBanks = (banks: QuestionBank[]) =>
  sortedBanks(banks).filter((bank) => !bank.parentId && !bank.archived);

export const getChildBanks = (banks: QuestionBank[], parentId: string) =>
  sortedBanks(banks).filter((bank) => bank.parentId === parentId && !bank.archived);

export const getRootIdForBank = (banks: QuestionBank[], bankId: string): string => {
  const byId = new Map(banks.map((bank) => [bank.id, bank]));
  let cursor = byId.get(bankId);
  let guard = 0;
  while (cursor?.parentId && guard < 10) {
    const parent = byId.get(cursor.parentId);
    if (!parent) break;
    cursor = parent;
    guard += 1;
  }
  return cursor?.id ?? bankId;
};

/** 返回题库及其直接子库（用于合并、删除确认等场景）。 */
export const getBankScopeIds = (banks: QuestionBank[], bankId: string) => {
  const children = banks.filter((bank) => bank.parentId === bankId).map((bank) => bank.id);
  return [bankId, ...children];
};

export const bankColorOf = (banks: QuestionBank[], bankId: string) =>
  banks.find((bank) => bank.id === bankId)?.color ?? "#2C4B43";
