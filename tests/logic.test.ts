/* 纯逻辑回归测试：由 rolldown 打包后通过 node 运行（见 package.json 的 test 脚本）。 */
import type { AppState, PracticeRecord, Question, QuestionBank, WrongQuestion } from "../src/types";
import { evaluateQuestion, sampleQuestions, weightedSampleQuestions } from "../src/lib/quiz";
import { createCatalog } from "../src/lib/catalog";
import { parseCsv, csvToObjects } from "../src/lib/csv";
import { parseAnswerText, formatAnswer, splitList, parseAliasesText } from "../src/lib/text";
import { createPracticeSession } from "../src/lib/session";
import {
  applyPracticeAnswer,
  deleteBank,
  deleteQuestion,
  emptyTrash,
  mergeBanks,
  purgeTrashEntry,
  restoreTrashEntry,
  updateWrongStatus,
  upsertQuestion
} from "../src/store/actions";
import { buildTemplate, createExamSession, evaluateExam, finalizeExam, pickExamQuestions } from "../src/lib/exam";
import { computeBankProgress, computeStats, sessionSummary } from "../src/lib/stats";
import { buildWrongBookHtml, defaultWrongBookOptions } from "../src/lib/notebook";
import { localDateKey, addDaysIso } from "../src/lib/date";

let passed = 0;
const failures: string[] = [];
let current = "";

const test = (name: string, run: () => void) => {
  current = name;
  try {
    run();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : String(error)}`);
  }
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const equal = <T,>(actual: T, expected: T, message = "") => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
};

const ts = "2026-10-01T08:00:00.000Z";

const bank = (id: string, name: string, parentId?: string, extra: Partial<QuestionBank> = {}): QuestionBank => ({
  id,
  name,
  description: "",
  parentId,
  sortIndex: 1,
  color: "#2C4B43",
  createdAt: ts,
  updatedAt: ts,
  ...extra
});

const question = (id: string, bankId: string, rootBankId: string, extra: Partial<Question> = {}): Question => ({
  id,
  bankId,
  rootBankId,
  type: "single",
  stem: `题干 ${id}`,
  options: [
    { key: "A", text: "选项 A" },
    { key: "B", text: "选项 B" },
    { key: "C", text: "选项 C" },
    { key: "D", text: "选项 D" }
  ],
  answer: ["A"],
  answerAliases: [],
  explanation: "解析",
  knowledgePoints: ["知识点"],
  tags: [],
  difficulty: 2,
  source: "",
  sortIndex: 1,
  createdAt: ts,
  updatedAt: ts,
  fingerprint: `fp-${id}`,
  ...extra
});

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  schemaVersion: 2,
  banks: [bank("b1", "一级")],
  questions: [question("q1", "b1", "b1")],
  records: [],
  wrongs: [],
  notes: [],
  exams: [],
  examSessions: [],
  practiceSession: null,
  settings: {
    theme: "light",
    autoNext: false,
    weightedWrongStrength: 2,
    weightedKnowledgeStrength: 3,
    reviewDailyTarget: 30
  },
  trash: [],
  ...overrides
});

const record = (overrides: Partial<PracticeRecord> = {}): PracticeRecord => ({
  id: `r-${Math.random().toString(36).slice(2)}`,
  questionId: "q1",
  sessionId: "s1",
  mode: "sequence",
  userAnswer: ["A"],
  isCorrect: true,
  score: 1,
  timeSpentMs: 1000,
  answeredAt: ts,
  ...overrides
});

const wrong = (overrides: Partial<WrongQuestion> = {}): WrongQuestion => ({
  questionId: "q1",
  wrongCount: 1,
  correctAfterWrongCount: 0,
  lastWrongAt: ts,
  masteryLevel: 0,
  wrongReasons: [],
  status: "active",
  nextReviewAt: ts,
  ...overrides
});

/* ---------- 判题 ---------- */
test("单选：正确与错误", () => {
  const q = question("q", "b", "b");
  assert(evaluateQuestion(q, ["A"]).isCorrect, "A 应为正确");
  const wrongAnswer = evaluateQuestion(q, ["B"]);
  assert(!wrongAnswer.isCorrect, "B 应为错误");
  equal(wrongAnswer.detail, "答案不一致");
});

test("多选：少选/多选提示", () => {
  const q = question("q", "b", "b", { type: "multiple", answer: ["A", "B", "C"] });
  equal(evaluateQuestion(q, ["A", "B"]).detail, "少选了 1 个正确选项");
  equal(evaluateQuestion(q, ["A", "B", "C", "D"]).detail, "多选了 1 个选项");
  equal(evaluateQuestion(q, ["A", "D"]).detail, "少选 2 个正确选项，多选 1 个错误选项");
  assert(evaluateQuestion(q, ["C", "B", "A"]).isCorrect, "顺序无关");
});

test("判断：同义词与全角归一化", () => {
  const q = question("q", "b", "b", { type: "judge", options: [], answer: ["true"] });
  assert(evaluateQuestion(q, ["对"]).isCorrect, "对应视为 true");
  assert(evaluateQuestion(q, ["√"]).isCorrect, "√ 应视为 true");
  assert(evaluateQuestion(q, ["正确"]).isCorrect, "正确应视为 true");
  assert(!evaluateQuestion(q, ["错"]).isCorrect, "错应为 false");
});

test("填空：等价答案与逐空定位", () => {
  const q = question("q", "b", "b", {
    type: "fill",
    options: [],
    answer: ["北京", "上海"],
    answerAliases: [["北京市"], []]
  });
  assert(evaluateQuestion(q, ["北京市", " 上海 "]).isCorrect, "应支持等价答案与空格归一化");
  equal(evaluateQuestion(q, ["北京", "广州"]).detail, "第 2 空与标准答案不一致");
  equal(evaluateQuestion(q, ["北京"]).detail, "填写了 1 个空，标准答案有 2 个空");
});

/* ---------- 文本与 CSV ---------- */
test("答案/列表解析", () => {
  equal(parseAnswerText("multiple", "A、B，C"), ["A", "B", "C"]);
  equal(parseAnswerText("judge", "对"), ["true"]);
  equal(parseAnswerText("fill", "北京；上海"), ["北京", "上海"]);
  equal(splitList("语文、数学;英语"), ["语文", "数学", "英语"]);
  equal(parseAliasesText("北京|北京市;上海"), [["北京", "北京市"], ["上海"]]);
  equal(formatAnswer(question("q", "b", "b", { type: "judge", answer: ["false"] })), "错误");
});

test("CSV：引号、逗号、换行与 BOM", () => {
  const text = '\uFEFF题干,答案\r\n"含,逗号","他说""好"""\r\n"多行\n内容",B\r\n';
  const rows = parseCsv(text);
  equal(rows.length, 3);
  equal(rows[1][1], '他说"好"');
  equal(rows[2][0], "多行\n内容");
  const objects = csvToObjects(rows);
  equal(objects[0]["题干"], "含,逗号");
});

/* ---------- 目录索引 ---------- */
const hierarchy = () => {
  const banks = [
    bank("b1", "一级", undefined, { sortIndex: 1 }),
    bank("b2", "子库", "b1", { sortIndex: 1 }),
    bank("b3", "孙库", "b2", { sortIndex: 1 }),
    bank("b4", "归档库", undefined, { archived: true })
  ];
  const questions = [
    question("q1", "b1", "b1"),
    question("q2", "b2", "b1", { type: "multiple" }),
    question("q3", "b3", "b1", { type: "judge" }),
    question("q4", "b2", "b1", { type: "fill" }),
    question("q5", "b4", "b4")
  ];
  return { banks, questions };
};

test("目录：根、子树、聚合题池与题型筛选", () => {
  const { banks, questions } = hierarchy();
  const catalog = createCatalog(banks, questions);
  equal(catalog.roots.map((item) => item.id), ["b1"]);
  equal(catalog.subtreeIds("b1").sort(), ["b1", "b2", "b3"]);
  equal(catalog.totalIn("b1"), 4);
  equal(catalog.totalIn("b2"), 2);
  equal(catalog.typeCounts("b1"), { single: 1, multiple: 1, judge: 1, fill: 1 });
  equal(catalog.pool("b1", ["fill"]).map((item) => item.id), ["q4"]);
  equal(catalog.questionById.has("q5"), false, "归档题库的题不应可见");
  equal(catalog.rootOf("b3"), "b1");
  equal(catalog.bankPath("b3").map((item) => item.name), ["一级", "子库", "孙库"]);
});

/* ---------- 状态操作 ---------- */
test("新增题目：深层题库正确回填根题库", () => {
  const { banks, questions } = hierarchy();
  const state = makeState({ banks, questions });
  const next = upsertQuestion(state, {
    bankId: "b3",
    type: "single",
    stem: "新题",
    options: [
      { key: "A", text: "A" },
      { key: "B", text: "B" }
    ],
    answer: ["A"],
    answerAliases: [],
    explanation: "",
    knowledgePoints: [],
    tags: [],
    difficulty: 2,
    source: ""
  });
  equal(next.questions.at(-1)?.rootBankId, "b1");
  equal(next.questions.at(-1)?.sortIndex, 2, "b3 中已有 q3，新题序号应为 2");
});

test("删除题目：同步清理记录、错题、笔记并保持当前题号", () => {
  const state = makeState({
    banks: [bank("b1", "一级")],
    questions: [question("q1", "b1", "b1"), question("q2", "b1", "b1"), question("q3", "b1", "b1")],
    records: [record({ id: "r1", questionId: "q1" })],
    wrongs: [wrong({ questionId: "q1" })],
    notes: [{ id: "n1", questionId: "q1", content: "笔记", updatedAt: ts }],
    practiceSession: {
      ...createPracticeSession(["q1", "q2", "q3"], "sequence"),
      currentIndex: 1,
      answers: { q1: ["A"], q2: ["A"] },
      submitted: { q1: true }
    }
  });
  const next = deleteQuestion(state, "q1");
  equal(next.questions.map((item) => item.id), ["q2", "q3"]);
  equal(next.records.length, 0);
  equal(next.wrongs.length, 0);
  equal(next.notes.length, 0);
  equal(next.practiceSession?.questionIds, ["q2", "q3"]);
  equal(next.practiceSession?.currentIndex, 0, "应停在原来的第二题（删除后索引 0）");
  equal(next.practiceSession?.answers, { q2: ["A"] });
});

test("删除题库：回收站恢复与彻底删除", () => {
  const { banks, questions } = hierarchy();
  const state = makeState({
    banks,
    questions,
    records: [record({ id: "r1", questionId: "q2" })],
    wrongs: [wrong({ questionId: "q2" })],
    practiceSession: { ...createPracticeSession(["q1", "q2"], "sequence"), currentIndex: 1 }
  });
  const catalog = createCatalog(state.banks, state.questions);
  const removed = deleteBank(state, catalog, "b2");
  equal(removed.trash.length, 1);
  equal(removed.banks.filter((item) => item.deletedAt).length, 2);
  equal(removed.practiceSession?.questionIds, ["q1"]);
  const restored = restoreTrashEntry(removed, removed.trash[0].id);
  equal(restored.banks.filter((item) => item.deletedAt).length, 0);
  equal(restored.trash.length, 0);
  const purged = purgeTrashEntry(removed, removed.trash[0].id);
  equal(purged.banks.some((item) => item.id === "b2"), false);
  equal(purged.questions.some((item) => item.id === "q2"), false);
  equal(purged.records.length, 0);
});

test("合并题库：移动题目、归档来源并支持撤销", () => {
  const { banks, questions } = hierarchy();
  const state = makeState({ banks, questions });
  const catalog = createCatalog(state.banks, state.questions);
  const merged = mergeBanks(state, catalog, "b2", "b4");
  equal(merged.questions.find((item) => item.id === "q2")?.bankId, "b4");
  equal(merged.questions.find((item) => item.id === "q3")?.bankId, "b4");
  equal(merged.banks.find((item) => item.id === "b2")?.archived, true);
  equal(merged.trash[0]?.kind, "merge");
  const undone = restoreTrashEntry(merged, merged.trash[0].id);
  equal(undone.questions.find((item) => item.id === "q2")?.bankId, "b2");
  equal(undone.banks.find((item) => item.id === "b2")?.archived, undefined);
});

test("清空回收站：多条目一次清理", () => {
  const { banks, questions } = hierarchy();
  let state = makeState({ banks, questions });
  let catalog = createCatalog(state.banks, state.questions);
  state = deleteBank(state, catalog, "b2");
  catalog = createCatalog(state.banks, state.questions);
  state = deleteBank(state, catalog, "b4");
  equal(state.trash.length, 2);
  const cleared = emptyTrash(state);
  equal(cleared.trash.length, 0);
  equal(cleared.banks.map((item) => item.id), ["b1"]);
});

test("错题状态：掌握安排 30 天后复习，忽略/恢复立即生效", () => {
  const state = makeState({ wrongs: [wrong()] });
  const mastered = updateWrongStatus(state, "q1", "mastered");
  assert(new Date(mastered.wrongs[0].nextReviewAt).getTime() > Date.now() + 20 * 86400000, "应安排远期复习");
  const restored = updateWrongStatus(mastered, "q1", "active");
  assert(new Date(restored.wrongs[0].nextReviewAt).getTime() <= Date.now(), "恢复后应立即到期");
});

/* ---------- 练习 ---------- */
test("练习记录：判题、错题回流与得分", () => {
  const q = question("q1", "b1", "b1");
  const session = createPracticeSession(["q1"], "sequence");
  const next = applyPracticeAnswer(makeState(), q, session, ["B"], false, 1500, "r1", ts);
  equal(next.records.length, 1);
  equal(next.records[0].isCorrect, false);
  equal(next.wrongs[0].wrongCount, 1);
  equal(next.wrongs[0].status, "active");
  equal(sessionSummary(next.records).accuracy, 0);
});

/* ---------- 统计 ---------- */
test("统计：今日、正确率、连续天数与题库进度", () => {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const state = makeState({
    questions: [question("q1", "b1", "b1"), question("q2", "b1", "b1")],
    records: [
      record({ id: "r1", answeredAt: now, isCorrect: true }),
      record({ id: "r2", questionId: "q2", answeredAt: yesterday, isCorrect: false })
    ],
    wrongs: [wrong({ questionId: "q2", nextReviewAt: now })]
  });
  const catalog = createCatalog(state.banks, state.questions);
  const stats = computeStats(state, catalog);
  equal(stats.answered, 2);
  equal(stats.correctRate, 50);
  equal(stats.todayCount, 1);
  equal(stats.streak, 2);
  equal(stats.dueReviews, 1);
  equal(localDateKey(now), localDateKey());
  const progress = computeBankProgress(state, catalog);
  equal(progress[0].answered, 2);
  equal(progress[0].wrong, 1);
  equal(progress[0].rate, 1);
});

/* ---------- 考试 ---------- */
test("组卷：按题型抽题、去重", () => {
  const { banks, questions } = hierarchy();
  const catalog = createCatalog(banks, questions);
  const template = buildTemplate({
    name: "测试",
    durationMinutes: 30,
    blueprint: [
      { bankId: "b1", single: 2, multiple: 1, judge: 1, fill: 1 },
      { bankId: "b2", single: 3, multiple: 0, judge: 0, fill: 0 }
    ]
  });
  const picked = pickExamQuestions(catalog, template);
  equal(new Set(picked.map((item) => item.id)).size, picked.length, "不应重复");
  assert(picked.length >= 3, "至少抽到可用的题目");
});

test("交卷：计分、写入记录、错题回流且幂等", () => {
  const { banks, questions } = hierarchy();
  const catalog = createCatalog(banks, questions);
  const template = buildTemplate({
    name: "小测",
    durationMinutes: 20,
    blueprint: [{ bankId: "b1", single: 1, multiple: 1, judge: 1, fill: 1 }]
  });
  const picked = pickExamQuestions(catalog, template);
  const session = createExamSession(template, picked);
  const answers: Record<string, string[]> = {};
  for (const item of picked) answers[item.id] = item.answer;
  const state = makeState({
    banks,
    questions,
    exams: [template],
    examSessions: [{ ...session, answers }]
  });
  const result = evaluateExam(state.examSessions[0], catalog, template);
  equal(result.wrong, 0);
  equal(result.unanswered, 0);
  const finalized = finalizeExam(state, session.id, catalog, "submitted");
  equal(finalized.examSessions[0].status, "submitted");
  equal(finalized.records.length, picked.length);
  equal(finalized.wrongs.length, 0);
  const again = finalizeExam(finalized, session.id, catalog, "submitted");
  equal(again.records.length, picked.length, "重复交卷不应重复计分");
});

/* ---------- 错题本导出 ---------- */
test("错题本 HTML：转义危险字符并包含笔记", () => {
  const state = makeState({
    questions: [question("q1", "b1", "b1", { stem: "<script>alert(1)</script>", explanation: "解析" })],
    wrongs: [wrong()],
    notes: [{ id: "n1", questionId: "q1", content: "我的笔记", updatedAt: ts }]
  });
  const catalog = createCatalog(state.banks, state.questions);
  const html = buildWrongBookHtml(state, catalog, undefined, { ...defaultWrongBookOptions, includeNotes: true });
  assert(!html.includes("<script>alert(1)</script>"), "题干必须转义");
  assert(html.includes("&lt;script&gt;"), "应包含转义后的题干");
  assert(html.includes("我的笔记"), "应包含笔记");
});

/* ---------- 抽样 ---------- */
test("抽样：数量边界与不重复", () => {
  const pool = Array.from({ length: 20 }, (_, index) => question(`q${index}`, "b", "b"));
  equal(sampleQuestions(pool, 5).length, 5);
  equal(new Set(sampleQuestions(pool, 20).map((item) => item.id)).size, 20);
  const weighted = weightedSampleQuestions(pool, 8, {
    wrongById: new Map(),
    knowledgeRates: new Map(),
    lastPracticedAt: new Map(),
    options: { wrongStrength: 2, knowledgeStrength: 3 }
  });
  equal(weighted.length, 8);
  equal(new Set(weighted.map((item) => item.id)).size, 8);
  equal(sampleQuestions(pool, 100).length, 20);
});

test("日期：本地日期与天数偏移", () => {
  const base = "2026-10-01T12:00:00.000Z";
  const later = addDaysIso(base, 3);
  assert(new Date(later).getTime() - new Date(base).getTime() === 3 * 86400000, "应增加 3 天");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
