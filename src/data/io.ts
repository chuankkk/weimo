import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { AppState, ImportReport, Question, QuestionBank, QuestionOption, QuestionType } from "../types";
import { getRootIdForBank } from "../lib/banks";
import { nowIso } from "../lib/date";
import { makeFingerprint, parseAnswerText, parseAliasesText, splitList, uid } from "../lib/text";
import { normalizeState } from "./storage";

export interface ImportOutcome {
  state: AppState;
  report: ImportReport;
  /** 完整备份恢复（覆盖当前数据）而不是合并题目 */
  restored: boolean;
}

const fieldNames = {
  rootBank: ["大题库", "rootBank", "root_bank", "题库", "题库名称"],
  childBank: ["小题库", "childBank", "child_bank", "子题库", "章节"],
  type: ["题型", "type", "questionType"],
  stem: ["题干", "stem", "question", "题目"],
  answer: ["答案", "answer", "correctAnswer"],
  aliases: ["可接受答案", "等价答案", "answerAliases", "aliases"],
  explanation: ["解析", "explanation", "analysis"],
  knowledge: ["知识点", "knowledgePoints", "knowledge", "考点"],
  tags: ["标签", "tags"],
  difficulty: ["难度", "difficulty"],
  source: ["来源", "source"],
  sortIndex: ["排序号", "sortIndex", "order"]
};

const getField = (row: Record<string, unknown>, names: string[]) => {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
};

const normalizeType = (raw: string): QuestionType | "" => {
  const value = raw.toLowerCase().trim();
  if (["单选", "单选题", "single", "radio", "1"].includes(value)) return "single";
  if (["多选", "多选题", "multiple", "checkbox", "2"].includes(value)) return "multiple";
  if (["判断", "判断题", "judge", "truefalse", "true/false", "3"].includes(value)) return "judge";
  if (["填空", "填空题", "fill", "blank", "4"].includes(value)) return "fill";
  return "";
};

const optionKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];

const parseOptions = (row: Record<string, unknown>) => {
  const options: QuestionOption[] = [];
  for (const key of optionKeys) {
    const value = row[`选项${key}`] ?? row[key] ?? row[`option${key}`] ?? row[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      options.push({ key, text: String(value).trim() });
    }
  }
  return options;
};

const ensureBank = (
  banks: QuestionBank[],
  name: string,
  parentId: string | undefined,
  color: string
): QuestionBank[] => {
  if (banks.some((bank) => bank.name === name && bank.parentId === parentId)) return banks;
  const createdAt = nowIso();
  return [
    ...banks,
    {
      id: uid("bank"),
      name,
      description: "由导入创建",
      parentId,
      sortIndex: banks.filter((bank) => bank.parentId === parentId).length + 1,
      color,
      createdAt,
      updatedAt: createdAt
    }
  ];
};

const findBankId = (banks: QuestionBank[], name: string, parentId?: string) =>
  banks.find((bank) => bank.name === name && bank.parentId === parentId)?.id;

const parseRowsFromJson = (text: string) => {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)) {
    return (parsed as { questions: Record<string, unknown>[] }).questions;
  }
  return [];
};

const isFullBackup = (parsed: unknown): parsed is AppState => {
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed as Record<string, unknown>;
  return Array.isArray(record.banks) && Array.isArray(record.questions);
};

const rowsToObjects = (rows: unknown[][]) => {
  const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").trim());
  return rows.slice(1).map((row) => {
    const object: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) object[header] = row[index] ?? "";
    });
    return object;
  });
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
};

const parseRowsFromCsv = (text: string) => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  return rowsToObjects(lines.map(parseCsvLine));
};

const mergeRows = (
  state: AppState,
  rows: Record<string, unknown>[],
  sourceName: string,
  report: ImportReport
): AppState => {
  let banks = [...state.banks];
  const questions = [...state.questions];
  const fingerprints = new Set(questions.map((question) => question.fingerprint));

  rows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const rootName = getField(row, fieldNames.rootBank) || "导入题库";
    const childName = getField(row, fieldNames.childBank);
    const type = normalizeType(getField(row, fieldNames.type));
    const stem = getField(row, fieldNames.stem);
    const answerRaw = getField(row, fieldNames.answer);
    const options = parseOptions(row);

    if (!stem) {
      report.errors.push(`第 ${line} 行：题干为空`);
      report.skipped += 1;
      return;
    }
    if (!type) {
      report.errors.push(`第 ${line} 行：题型无法识别（应为单选 / 多选 / 判断 / 填空）`);
      report.skipped += 1;
      return;
    }
    if (!answerRaw) {
      report.errors.push(`第 ${line} 行：答案为空`);
      report.skipped += 1;
      return;
    }
    if (["single", "multiple"].includes(type) && options.length < 2) {
      report.errors.push(`第 ${line} 行：选择题至少需要两个选项`);
      report.skipped += 1;
      return;
    }

    banks = ensureBank(banks, rootName, undefined, "#2C4B43");
    const rootId = findBankId(banks, rootName);
    if (!rootId) {
      report.errors.push(`第 ${line} 行：题库创建失败`);
      report.skipped += 1;
      return;
    }
    if (childName) banks = ensureBank(banks, childName, rootId, "#455D73");
    const bankId = childName ? findBankId(banks, childName, rootId) ?? rootId : rootId;
    const answer = parseAnswerText(type, answerRaw);
    const fingerprint = makeFingerprint(stem, options, answer);

    if (fingerprints.has(fingerprint)) {
      report.warnings.push(`第 ${line} 行：疑似重复题，已跳过`);
      report.skipped += 1;
      return;
    }

    const createdAt = nowIso();
    const question: Question = {
      id: uid("q"),
      bankId,
      rootBankId: getRootIdForBank(banks, bankId),
      type,
      stem,
      options,
      answer,
      answerAliases: parseAliasesText(getField(row, fieldNames.aliases)),
      explanation: getField(row, fieldNames.explanation),
      knowledgePoints: splitList(getField(row, fieldNames.knowledge)),
      tags: splitList(getField(row, fieldNames.tags)),
      difficulty: Math.min(5, Math.max(1, Number(getField(row, fieldNames.difficulty)) || 2)),
      source: getField(row, fieldNames.source) || sourceName,
      sortIndex: Number(getField(row, fieldNames.sortIndex)) || questions.length + 1,
      createdAt,
      updatedAt: createdAt,
      fingerprint
    };

    if (!question.explanation) report.warnings.push(`第 ${line} 行：解析为空`);
    if (!question.knowledgePoints.length) report.warnings.push(`第 ${line} 行：知识点为空`);
    fingerprints.add(fingerprint);
    questions.push(question);
    report.imported += 1;
  });

  return { ...state, banks, questions };
};

const parseWorkbookRows = async (file: File) => {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  const rows: Record<string, unknown>[] = [];
  for (const sheet of sheets) {
    const data = sheet.data ?? [];
    if (data.length > 1) rows.push(...rowsToObjects(data as unknown[][]));
  }
  return rows;
};

export const importDataFile = async (state: AppState, file: File): Promise<ImportOutcome> => {
  const report: ImportReport = { imported: 0, skipped: 0, errors: [], warnings: [] };
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".json")) {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {
        state,
        restored: false,
        report: { ...report, errors: [`JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`] }
      };
    }
    if (isFullBackup(parsed)) {
      const restored = normalizeState(parsed);
      return {
        state: restored,
        restored: true,
        report: { ...report, imported: restored.questions.length }
      };
    }
    const rows = parseRowsFromJson(text);
    if (!rows.length) {
      return { state, restored: false, report: { ...report, errors: ["没有读取到任何题目行"] } };
    }
    try {
      return { state: mergeRows(state, rows, file.name, report), report, restored: false };
    } catch (error) {
      return {
        state,
        restored: false,
        report: { ...report, errors: [`导入失败：${error instanceof Error ? error.message : "未知错误"}`] }
      };
    }
  }

  let rows: Record<string, unknown>[] = [];
  try {
    if (lowerName.endsWith(".csv")) {
      rows = parseRowsFromCsv(await file.text());
    } else {
      rows = await parseWorkbookRows(file);
    }
  } catch (error) {
    return {
      state,
      restored: false,
      report: {
        ...report,
        errors: [`文件解析失败：${error instanceof Error ? error.message : "未知错误"}`]
      }
    };
  }

  if (!rows.length) {
    return { state, restored: false, report: { ...report, errors: ["没有读取到任何题目行"] } };
  }

  return { state: mergeRows(state, rows, file.name, report), report, restored: false };
};

const rowsFromState = (state: AppState) => {
  const bankById = new Map(state.banks.map((bank) => [bank.id, bank]));
  const visibleBankIds = new Set(
    state.banks.filter((bank) => !bank.archived && !bank.deletedAt).map((bank) => bank.id)
  );
  return state.questions
    .filter((question) => visibleBankIds.has(question.bankId) && visibleBankIds.has(question.rootBankId))
    .map((question) => {
      const root = bankById.get(question.rootBankId);
      const child = bankById.get(question.bankId);
      const row: Record<string, string | number> = {
        大题库: root?.name ?? "",
        小题库: child?.parentId ? child.name : "",
        题型: question.type,
        题干: question.stem,
        答案: question.answer.join(","),
        可接受答案: question.answerAliases.map((aliases) => aliases.join("|")).join(";"),
        解析: question.explanation,
        知识点: question.knowledgePoints.join(";"),
        标签: question.tags.join(";"),
        难度: question.difficulty,
        来源: question.source,
        排序号: question.sortIndex
      };
      for (const option of question.options) row[`选项${option.key}`] = option.text;
      return row;
    });
};

const browserDownloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const downloadBlob = async (filename: string, blob: Blob) => {
  if (!Capacitor.isNativePlatform()) {
    browserDownloadBlob(filename, blob);
    return;
  }
  try {
    const data = await blobToBase64(blob);
    const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({
      title: filename,
      text: "闱墨导出文件",
      files: [file.uri],
      dialogTitle: "导出闱墨文件"
    });
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    throw error;
  }
};

const datedName = (suffix: string) => `闱墨${suffix}-${nowIso().slice(0, 10)}`;

export const exportJsonBackup = async (state: AppState) => {
  await downloadBlob(
    `${datedName("完整备份")}.json`,
    new Blob([JSON.stringify({ ...state, schemaVersion: 2 }, null, 2)], {
      type: "application/json;charset=utf-8"
    })
  );
};

export const exportQuestionExcel = async (state: AppState) => {
  if (!state.questions.length) throw new Error("当前没有可导出的题目");
  const rows = rowsFromState(state);
  const headers = Object.keys(
    rows[0] ?? { 大题库: "", 小题库: "", 题型: "", 题干: "", 答案: "" }
  );
  const data = [
    headers.map((header) => ({ value: header, fontWeight: "bold" as const })),
    ...rows.map((row) => headers.map((header) => ({ value: row[header] ?? "" })))
  ];
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob = await writeXlsxFile(data).toBlob();
  await downloadBlob(`${datedName("题库")}.xlsx`, blob);
};

export const exportQuestionCsv = async (state: AppState) => {
  if (!state.questions.length) throw new Error("当前没有可导出的题目");
  const rows = rowsFromState(state);
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  // BOM 让 Excel 正确识别 UTF-8 中文
  await downloadBlob(
    `${datedName("题库")}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  );
};

export const exportImportTemplate = async () => {
  const headers = [
    "大题库",
    "小题库",
    "题型",
    "题干",
    "选项A",
    "选项B",
    "选项C",
    "选项D",
    "答案",
    "可接受答案",
    "解析",
    "知识点",
    "标签",
    "难度",
    "来源"
  ];
  const sample = [
    "公务员行测",
    "言语理解",
    "单选",
    "下列句子中，表达最准确的一项是：",
    "通过这次活动，使大家认识到坚持的重要。",
    "这次活动让大家认识到坚持的重要。",
    "经过这次活动，使大家认识坚持的重要。",
    "这次活动被大家认识到坚持的重要。",
    "B",
    "",
    "A、C 主语残缺，D 搭配不当。",
    "病句辨析;言语理解",
    "语病",
    "2",
    "导入模板"
  ];
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const csv = [headers, sample].map((row) => row.map(escape).join(",")).join("\n");
  await downloadBlob("闱墨题库导入模板.csv", new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
};

