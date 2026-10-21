import type { Catalog } from "../../lib/catalog";
import { makeDefaultBlueprint } from "../../lib/exam";

export const defaultDraftName = "自定义模拟考试";

export const makeDraft = (catalog: Catalog) => ({
  name: defaultDraftName,
  durationMinutes: 90,
  blueprint: makeDefaultBlueprint(catalog)
});

export type Draft = ReturnType<typeof makeDraft>;
