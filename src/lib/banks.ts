import type { QuestionBank } from "../types";

/** 读取题库到根题库的 id，带循环保护。 */
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

/** “一级题库 / 子库”形式的完整路径，缺失时回退到“未命名题库”。 */
export const bankPathLabel = (banks: QuestionBank[], bankId: string): string => {
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
