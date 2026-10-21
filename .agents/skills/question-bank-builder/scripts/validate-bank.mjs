#!/usr/bin/env node
/**
 * 闱墨题库格式校验器（无第三方依赖）
 *
 * 用法：
 *   node validate-bank.mjs <bank.csv|bank.json> [--strict] [--json]
 *
 * 退出码：
 *   0  格式可导入（--strict 时还要求无警告）
 *   1  存在错误，或 --strict 下存在警告
 *   2  文件读取/解析失败
 */

import fs from "node:fs";
import path from "node:path";

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const FIELDS = {
  root: ["大题库", "rootBank", "root_bank", "题库", "题库名称"],
  child: ["小题库", "childBank", "child_bank", "子题库", "章节"],
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

const TRUE_WORDS = ["对", "正确", "true", "t", "yes", "y", "是", "√", "对的"];
const FALSE_WORDS = ["错", "错误", "false", "f", "no", "n", "否", "×", "x", "错的"];

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(
    "用法: node validate-bank.mjs <题库.csv|题库.json> [--strict] [--json]\n\n" +
      "  --strict  把警告也视为失败\n" +
      "  --json    输出机器可读的 JSON 报告"
  );
  process.exit(args.length ? 0 : 2);
}

const filePath = args.find((arg) => !arg.startsWith("-"));
const strict = args.includes("--strict");
const asJson = args.includes("--json");
if (!filePath) {
  console.error("缺少题库文件路径。");
  process.exit(2);
}

const absPath = path.resolve(filePath);
if (!fs.existsSync(absPath)) {
  console.error(`文件不存在: ${absPath}`);
  process.exit(2);
}

const normalizeText = (value) =>
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

const normalizeType = (raw) => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["单选", "单选题", "single", "radio", "1"].includes(value)) return "single";
  if (["多选", "多选题", "multiple", "checkbox", "2"].includes(value)) return "multiple";
  if (["判断", "判断题", "judge", "truefalse", "true/false", "3"].includes(value)) return "judge";
  if (["填空", "填空题", "fill", "blank", "4"].includes(value)) return "fill";
  return "";
};

const typeLabel = { single: "单选", multiple: "多选", judge: "判断", fill: "填空" };

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, "");
  const physicalLines = source.split(/\r?\n/);
  const rows = [];
  physicalLines.forEach((line, index) => {
    if (!line.trim()) return;
    const cells = [];
    let current = "";
    let quoted = false;
    for (let cursor = 0; cursor < line.length; cursor += 1) {
      const char = line[cursor];
      const next = line[cursor + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        cursor += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    if (quoted) {
      throw new Error(
        `CSV 第 ${index + 1} 行引号未闭合。闱墨按行读取 CSV，单元格内不能换行；请把解析中的换行改为单行文本。`
      );
    }
    cells.push(current);
    rows.push({ cells, line: index + 1 });
  });
  if (!rows.length) throw new Error("文件为空。");
  const header = rows[0].cells.map((cell) => String(cell).trim());
  const objects = [];
  for (const row of rows.slice(1)) {
    const object = {};
    header.forEach((name, index) => {
      if (name) object[name] = row.cells[index] ?? "";
    });
    objects.push({ row: object, line: row.line });
  }
  return { header, rows: objects };
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed.map((row, index) => ({ row, line: index + 1 }));
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.questions)) {
    if (Array.isArray(parsed.banks)) {
      throw new Error(
        "这是闱墨的完整备份（同时包含 banks 与 questions），会被应用识别为覆盖恢复，而不是合并导入。请只输出 rows 数组或 { questions: [...] }。"
      );
    }
    return parsed.questions.map((row, index) => ({ row, line: index + 1 }));
  }
  throw new Error("JSON 必须是题目行数组，或 { questions: [...] }。");
}

function getField(row, aliases) {
  for (const name of aliases) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

const getOption = (row, key) => {
  const value =
    row[`选项${key}`] ?? row[key] ?? row[`option${key}`] ?? row[key.toLowerCase()] ?? "";
  return String(value).trim();
};

function parseOptions(row) {
  return OPTION_KEYS.map((key) => ({ key, text: getOption(row, key) })).filter((item) => item.text);
}

function splitAnswerTokens(raw) {
  return String(raw)
    .split(/[,，、\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function parseAnswer(type, raw) {
  if (type === "fill") return String(raw).split(/[;；]/).map((item) => item.trim());
  if (type === "judge") {
    const normalized = normalizeText(raw);
    if (TRUE_WORDS.includes(normalized)) return ["true"];
    if (FALSE_WORDS.includes(normalized)) return ["false"];
    return null;
  }
  return splitAnswerTokens(raw);
}

const splitList = (raw) =>
  String(raw)
    .split(/[;；,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseAliases = (raw) => {
  if (!String(raw).trim()) return [];
  return String(raw)
    .split(/[;；]/)
    .map((part) => part.split("|").map((item) => item.trim()).filter(Boolean))
    .filter((part) => part.length);
};

const countBlanks = (stem) => (String(stem).match(/[_＿]{2,}/g) ?? []).length;

const fingerprint = (stem, options, answer) =>
  normalizeText(
    `${stem}|${options.map((option) => `${option.key}:${option.text}`).join("|")}|${answer.join(",")}`
  );

const report = {
  file: absPath,
  format: path.extname(absPath).toLowerCase().replace(".", ""),
  strict,
  rows: 0,
  importable: 0,
  errors: [],
  warnings: [],
  types: { single: 0, multiple: 0, judge: 0, fill: 0 },
  roots: {},
  difficulties: {},
  passed: false
};

const addError = (line, message) => report.errors.push({ line, message });
const addWarning = (line, message) => report.warnings.push({ line, message });

let parsed;
try {
  const ext = path.extname(absPath).toLowerCase();
  const text = fs.readFileSync(absPath, "utf8");
  if (ext === ".json") {
    parsed = parseJson(text);
    report.format = "json";
  } else if (ext === ".csv" || ext === ".txt") {
    parsed = parseCsv(text);
    report.format = "csv";
    const header = parsed.header;
    if (!header.some((name) => FIELDS.type.includes(name))) addError(1, "缺少“题型”列。");
    if (!header.some((name) => FIELDS.stem.includes(name))) addError(1, "缺少“题干”列。");
    if (!header.some((name) => FIELDS.answer.includes(name))) addError(1, "缺少“答案”列。");
    if (!header.some((name) => FIELDS.root.includes(name))) addWarning(1, "缺少“大题库”列，导入时将归入“导入题库”。");
    parsed = parsed.rows;
  } else {
    throw new Error("只支持 .csv、.txt 或 .json；Excel 请先在应用内导入，或另存为 CSV。");
  }
} catch (error) {
  console.error(`无法解析题库: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

report.rows = parsed.length;
if (!report.rows) addError(1, "没有读取到任何题目行。");

const seen = new Map();

parsed.forEach(({ row, line }, index) => {
  const rowErrors = [];
  const rowWarnings = [];
  const pushError = (message) => {
    rowErrors.push(message);
    addError(line, message);
  };
  const pushWarning = (message) => {
    rowWarnings.push(message);
    addWarning(line, message);
  };

  const root = getField(row, FIELDS.root);
  const child = getField(row, FIELDS.child);
  const type = normalizeType(getField(row, FIELDS.type));
  const stem = getField(row, FIELDS.stem);
  const answerRaw = getField(row, FIELDS.answer);
  const options = parseOptions(row);

  if (!root) pushWarning("大题库为空，导入时会归入“导入题库”。");
  if (!stem) pushError("题干为空。");
  if (!type) pushError("题型无法识别（应为单选/多选/判断/填空）。");
  if (!answerRaw) pushError("答案为空。");

  if (type === "single" || type === "multiple") {
    if (options.length < 2) pushError("选择题至少需要两个选项。");
    const keys = options.map((option) => option.key);
    const expectedKeys = OPTION_KEYS.slice(0, keys.length);
    if (keys.some((key, keyIndex) => key !== expectedKeys[keyIndex])) {
      pushWarning(`选项键不连续：${keys.join(",")}（建议从 A 开始连续填写）。`);
    }
    const texts = options.map((option) => normalizeText(option.text));
    if (new Set(texts).size !== texts.length) pushWarning("存在重复选项文本。");
    const answer = parseAnswer(type, answerRaw);
    if (!answer?.length) {
      pushError("答案为空或无法解析。");
    } else {
      if (type === "single" && answer.length !== 1) pushError("单选题必须恰好一个答案。");
      if (type === "multiple" && answer.length < 2) pushError("多选题至少需要两个答案。");
      const missing = answer.filter((token) => !keys.includes(token));
      if (missing.length) pushError(`答案 ${missing.join(",")} 不在选项 ${keys.join(",")} 中。`);
    }
  } else if (type === "judge") {
    if (options.length) pushWarning("判断题不应填写选项。");
    const answer = parseAnswer(type, answerRaw);
    if (!answer) pushError("判断题答案应为 对/错/正确/错误/true/false/√/×。");
  } else if (type === "fill") {
    if (options.length) pushWarning("填空题不应填写选项。");
    const answer = parseAnswer(type, answerRaw) ?? [];
    if (!answer.length || answer.some((item) => !item)) pushError("填空题每个空都必须有答案，多个空用 ; 分隔。");
    const blanks = countBlanks(stem);
    if (blanks > 0 && answer.length !== blanks) {
      pushError(`题干有 ${blanks} 个空，但答案有 ${answer.length} 组。`);
    } else if (blanks === 0) {
      pushWarning("题干未发现连续下划线（____），应用会按答案组数生成输入框。");
    }
    const aliases = parseAliases(getField(row, FIELDS.aliases));
    if (aliases.length && aliases.length !== answer.length) {
      pushError(`可接受答案有 ${aliases.length} 组，但填空答案有 ${answer.length} 组。`);
    }
    aliases.forEach((group, aliasIndex) => {
      if (!group.length) pushError(`第 ${aliasIndex + 1} 个空的可接受答案为空组。`);
    });
  }

  const difficultyRaw = getField(row, FIELDS.difficulty);
  if (difficultyRaw) {
    const difficulty = Number(difficultyRaw);
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      pushWarning(`难度“${difficultyRaw}”不是 1–5 的整数，应用会回退到 2。`);
    }
  }

  if (!getField(row, FIELDS.explanation)) pushWarning("解析为空。");
  if (!getField(row, FIELDS.knowledge)) pushWarning("知识点为空。");
  const sortRaw = getField(row, FIELDS.sortIndex);
  if (sortRaw && !Number.isFinite(Number(sortRaw))) pushWarning(`排序号“${sortRaw}”不是数字。`);

  if (stem && answerRaw && type) {
    const answer = parseAnswer(type, answerRaw) ?? [];
    const key = fingerprint(stem, options, answer);
    if (seen.has(key)) {
      pushError(`与第 ${seen.get(key)} 行题干、选项和答案完全相同，应用会作为重复题跳过。`);
    } else {
      seen.set(key, line);
    }
  }

  if (!rowErrors.length) {
    report.importable += 1;
    if (type) report.types[type] += 1;
    if (root) report.roots[root] = (report.roots[root] ?? 0) + 1;
    const difficulty = Number(getField(row, FIELDS.difficulty)) || 2;
    report.difficulties[difficulty] = (report.difficulties[difficulty] ?? 0) + 1;
  }

  void index;
  void rowWarnings;
});

report.passed = report.errors.length === 0 && (!strict || report.warnings.length === 0);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const lines = [];
  lines.push(`闱墨题库校验 · ${path.basename(absPath)}`);
  lines.push(`格式: ${report.format.toUpperCase()}  总行数: ${report.rows}  可导入: ${report.importable}`);
  lines.push(
    `题型: 单选 ${report.types.single} · 多选 ${report.types.multiple} · 判断 ${report.types.judge} · 填空 ${report.types.fill}`
  );
  lines.push(`错误: ${report.errors.length}  警告: ${report.warnings.length}  ${strict ? "严格模式" : "普通模式"}`);
  if (Object.keys(report.roots).length) {
    lines.push(`大题库: ${Object.entries(report.roots).map(([name, count]) => `${name}(${count})`).join(" · ")}`);
  }
  if (report.errors.length) {
    lines.push("", "错误：");
    report.errors.slice(0, 40).forEach((item) => lines.push(`  第 ${item.line} 行: ${item.message}`));
    if (report.errors.length > 40) lines.push(`  ……还有 ${report.errors.length - 40} 条错误`);
  }
  if (report.warnings.length) {
    lines.push("", "警告：");
    report.warnings.slice(0, 30).forEach((item) => lines.push(`  第 ${item.line} 行: ${item.message}`));
    if (report.warnings.length > 30) lines.push(`  ……还有 ${report.warnings.length - 30} 条警告`);
  }
  lines.push("", report.passed ? "✅ 通过：可以导入闱墨。" : "❌ 未通过：请修复后再导入。");
  console.log(lines.join("\n"));
}

process.exit(report.passed ? 0 : 1);
