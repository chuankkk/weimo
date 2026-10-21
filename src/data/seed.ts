import type { AppState, ExamTemplate, Question, QuestionBank } from "../types";
import { nowIso } from "../lib/date";
import { makeFingerprint } from "../lib/text";

const createdAt = nowIso();

export const seedBanks: QuestionBank[] = [
  {
    id: "bank-root-xingce",
    name: "公务员行测",
    description: "言语、数量、判断和常识的综合练习题库",
    sortIndex: 1,
    color: "#2C4B43",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-verbal",
    name: "言语理解",
    description: "中心理解、逻辑填空、语句排序",
    parentId: "bank-root-xingce",
    sortIndex: 1,
    color: "#455D73",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-math",
    name: "数量关系",
    description: "工程、行程、排列组合、概率",
    parentId: "bank-root-xingce",
    sortIndex: 2,
    color: "#8B6833",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-common",
    name: "常识判断",
    description: "法律、科技、人文、地理",
    parentId: "bank-root-xingce",
    sortIndex: 3,
    color: "#7B5C63",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-root-math",
    name: "初中数学",
    description: "代数、几何、函数基础",
    sortIndex: 2,
    color: "#9E3F32",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-algebra",
    name: "代数基础",
    description: "方程、不等式和函数",
    parentId: "bank-root-math",
    sortIndex: 1,
    color: "#556B4F",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-root-english",
    name: "英语四级",
    description: "核心词汇、阅读理解与语法巩固",
    sortIndex: 3,
    color: "#455D73",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-vocab",
    name: "核心词汇",
    description: "高频词义、词形变化与固定搭配",
    parentId: "bank-root-english",
    sortIndex: 1,
    color: "#7A5547",
    createdAt,
    updatedAt: createdAt
  },
  {
    id: "bank-reading",
    name: "阅读理解",
    description: "主旨、细节、推断与词义猜测",
    parentId: "bank-root-english",
    sortIndex: 2,
    color: "#556B4F",
    createdAt,
    updatedAt: createdAt
  }
];

const q = (question: Omit<Question, "createdAt" | "updatedAt" | "fingerprint">): Question => ({
  ...question,
  createdAt,
  updatedAt: createdAt,
  fingerprint: makeFingerprint(question.stem, question.options, question.answer)
});

export const seedQuestions: Question[] = [
  q({
    id: "q-verbal-1",
    bankId: "bank-verbal",
    rootBankId: "bank-root-xingce",
    type: "single",
    stem: "下列句子中，表达最准确的一项是：",
    options: [
      { key: "A", text: "通过这次活动，使大家认识到坚持的重要。" },
      { key: "B", text: "这次活动让大家认识到坚持的重要。" },
      { key: "C", text: "经过这次活动，使大家认识坚持的重要。" },
      { key: "D", text: "这次活动被大家认识到坚持的重要。" }
    ],
    answer: ["B"],
    answerAliases: [],
    explanation: "A、C 缺少主语，属于“通过……使……”造成的成分残缺；D 被动搭配不当。B 表达完整自然。",
    knowledgePoints: ["病句辨析", "言语理解"],
    tags: ["语病"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-verbal-2",
    bankId: "bank-verbal",
    rootBankId: "bank-root-xingce",
    type: "multiple",
    stem: "下列属于议论文常见论证方法的有：",
    options: [
      { key: "A", text: "举例论证" },
      { key: "B", text: "道理论证" },
      { key: "C", text: "比喻论证" },
      { key: "D", text: "环境描写" }
    ],
    answer: ["A", "B", "C"],
    answerAliases: [],
    explanation: "举例、道理、比喻都是议论文常见的论证方法；环境描写属于文学表达手法。",
    knowledgePoints: ["论证方法", "言语理解"],
    tags: ["多选"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-verbal-3",
    bankId: "bank-verbal",
    rootBankId: "bank-root-xingce",
    type: "fill",
    stem: "成语“画蛇添足”的核心含义是____。",
    options: [],
    answer: ["多此一举"],
    answerAliases: [["多此一举", "做多余的事", "多余"]],
    explanation: "画蛇添足比喻做了多余的事，反而把事情弄坏。填写“多此一举”或“做多余的事”均可。",
    knowledgePoints: ["成语理解", "言语理解"],
    tags: ["填空"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 3
  }),
  q({
    id: "q-verbal-4",
    bankId: "bank-verbal",
    rootBankId: "bank-root-xingce",
    type: "judge",
    stem: "“不刊之论”指不能刊登的言论。",
    options: [],
    answer: ["false"],
    answerAliases: [],
    explanation: "“刊”是削除、更改之意，“不刊之论”指正确而不可修改的言论，并非不能刊登。",
    knowledgePoints: ["成语误用", "言语理解"],
    tags: ["判断"],
    difficulty: 3,
    source: "演示题库",
    sortIndex: 4
  }),
  q({
    id: "q-verbal-5",
    bankId: "bank-verbal",
    rootBankId: "bank-root-xingce",
    type: "fill",
    stem: "“三人行，必有我师焉”出自《____》，下一句是“____”。",
    options: [],
    answer: ["论语", "择其善者而从之"],
    answerAliases: [["论语", "论语·述而"], ["择其善者而从之", "其不善者而改之"]],
    explanation: "出自《论语·述而》，完整句为“三人行，必有我师焉。择其善者而从之，其不善者而改之”。",
    knowledgePoints: ["名句默写", "言语理解"],
    tags: ["填空", "文学常识"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 5
  }),
  q({
    id: "q-math-1",
    bankId: "bank-math",
    rootBankId: "bank-root-xingce",
    type: "single",
    stem: "某工程甲队单独做 10 天完成，乙队单独做 15 天完成，两队合作需要几天完成？",
    options: [
      { key: "A", text: "4 天" },
      { key: "B", text: "5 天" },
      { key: "C", text: "6 天" },
      { key: "D", text: "7 天" }
    ],
    answer: ["C"],
    answerAliases: [],
    explanation: "甲效率 1/10，乙效率 1/15，合作效率 1/10 + 1/15 = 1/6，所以需要 6 天。",
    knowledgePoints: ["工程问题", "数量关系"],
    tags: ["计算"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-math-2",
    bankId: "bank-math",
    rootBankId: "bank-root-xingce",
    type: "fill",
    stem: "从 1、2、3、4 中任选两个不同数字组成两位数，共有____个。",
    options: [],
    answer: ["12"],
    answerAliases: [["12", "十二"]],
    explanation: "十位有 4 种选择，个位剩下 3 种，共 4 × 3 = 12 个。",
    knowledgePoints: ["排列组合", "数量关系"],
    tags: ["填空", "排列"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-math-3",
    bankId: "bank-math",
    rootBankId: "bank-root-xingce",
    type: "multiple",
    stem: "下列关于概率的说法正确的有：",
    options: [
      { key: "A", text: "必然事件的概率为 1" },
      { key: "B", text: "不可能事件的概率为 0" },
      { key: "C", text: "任意事件概率都大于 1" },
      { key: "D", text: "概率可以表示事件发生可能性的大小" }
    ],
    answer: ["A", "B", "D"],
    answerAliases: [],
    explanation: "概率的取值范围是 0 到 1，因此 C 错误；其余三项均为概率的基本性质。",
    knowledgePoints: ["概率", "数量关系"],
    tags: ["多选"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 3
  }),
  q({
    id: "q-math-4",
    bankId: "bank-math",
    rootBankId: "bank-root-xingce",
    type: "single",
    stem: "一项工作甲单独完成需要 12 小时，乙单独完成需要 18 小时。两人合作 4 小时后，还剩全部工作的几分之几？",
    options: [
      { key: "A", text: "1/3" },
      { key: "B", text: "1/4" },
      { key: "C", text: "5/9" },
      { key: "D", text: "4/9" }
    ],
    answer: ["D"],
    answerAliases: [],
    explanation: "合作效率 1/12 + 1/18 = 5/36，4 小时完成 20/36 = 5/9，剩余 4/9。",
    knowledgePoints: ["工程问题", "数量关系"],
    tags: ["计算"],
    difficulty: 3,
    source: "演示题库",
    sortIndex: 4
  }),
  q({
    id: "q-common-1",
    bankId: "bank-common",
    rootBankId: "bank-root-xingce",
    type: "judge",
    stem: "我国宪法具有最高法律效力。",
    options: [],
    answer: ["true"],
    answerAliases: [],
    explanation: "宪法是国家的根本法，具有最高的法律地位、法律权威和法律效力。",
    knowledgePoints: ["宪法", "常识判断"],
    tags: ["法律"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-common-2",
    bankId: "bank-common",
    rootBankId: "bank-root-xingce",
    type: "single",
    stem: "下列属于可再生能源的是：",
    options: [
      { key: "A", text: "煤炭" },
      { key: "B", text: "石油" },
      { key: "C", text: "太阳能" },
      { key: "D", text: "天然气" }
    ],
    answer: ["C"],
    answerAliases: [],
    explanation: "太阳能可以持续获得、循环利用，属于可再生能源；煤炭、石油、天然气均为化石能源。",
    knowledgePoints: ["能源常识", "常识判断"],
    tags: ["科技"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-common-3",
    bankId: "bank-common",
    rootBankId: "bank-root-xingce",
    type: "multiple",
    stem: "下列关于我国国家机构的说法，正确的有：",
    options: [
      { key: "A", text: "全国人民代表大会是最高国家权力机关" },
      { key: "B", text: "国务院是最高国家行政机关" },
      { key: "C", text: "人民法院是国家的审判机关" },
      { key: "D", text: "人民检察院行使国家立法权" }
    ],
    answer: ["A", "B", "C"],
    answerAliases: [],
    explanation: "人民检察院是国家的法律监督机关，国家立法权由全国人民代表大会及其常务委员会行使。",
    knowledgePoints: ["国家机构", "常识判断"],
    tags: ["法律", "多选"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 3
  }),
  q({
    id: "q-algebra-1",
    bankId: "bank-algebra",
    rootBankId: "bank-root-math",
    type: "single",
    stem: "方程 2x + 3 = 11 的解是：",
    options: [
      { key: "A", text: "x = 2" },
      { key: "B", text: "x = 3" },
      { key: "C", text: "x = 4" },
      { key: "D", text: "x = 5" }
    ],
    answer: ["C"],
    answerAliases: [],
    explanation: "移项得 2x = 8，所以 x = 4。",
    knowledgePoints: ["一元一次方程", "代数"],
    tags: ["方程"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-algebra-2",
    bankId: "bank-algebra",
    rootBankId: "bank-root-math",
    type: "fill",
    stem: "若 a=3，b=5，则 a+b=____。",
    options: [],
    answer: ["8"],
    answerAliases: [["8", "八"]],
    explanation: "直接代入计算：3 + 5 = 8。",
    knowledgePoints: ["代数求值", "代数"],
    tags: ["填空"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-algebra-3",
    bankId: "bank-algebra",
    rootBankId: "bank-root-math",
    type: "multiple",
    stem: "下列式子中，与 2(a+b) 等价的有：",
    options: [
      { key: "A", text: "2a + 2b" },
      { key: "B", text: "a + b + a + b" },
      { key: "C", text: "2a + b" },
      { key: "D", text: "a + 2b" }
    ],
    answer: ["A", "B"],
    answerAliases: [],
    explanation: "根据乘法分配律，2(a+b) = 2a + 2b；同时它等于 (a+b) 相加两次，即 a + b + a + b。",
    knowledgePoints: ["整式运算", "代数"],
    tags: ["多选"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 3
  }),
  q({
    id: "q-algebra-4",
    bankId: "bank-algebra",
    rootBankId: "bank-root-math",
    type: "judge",
    stem: "若 a > b，则 -a > -b 一定成立。",
    options: [],
    answer: ["false"],
    answerAliases: [],
    explanation: "不等式两边同乘负数，不等号方向要改变，因此应有 -a < -b。",
    knowledgePoints: ["不等式性质", "代数"],
    tags: ["判断"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 4
  }),
  q({
    id: "q-vocab-1",
    bankId: "bank-vocab",
    rootBankId: "bank-root-english",
    type: "single",
    stem: "The new policy will ______ the development of small businesses.",
    options: [
      { key: "A", text: "accelerate" },
      { key: "B", text: "celebrate" },
      { key: "C", text: "calculate" },
      { key: "D", text: "circulate" }
    ],
    answer: ["A"],
    answerAliases: [],
    explanation: "accelerate 表示“加速、促进”，与 the development 搭配自然；其余选项语义不符。",
    knowledgePoints: ["动词辨析", "核心词汇"],
    tags: ["词汇"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-vocab-2",
    bankId: "bank-vocab",
    rootBankId: "bank-root-english",
    type: "fill",
    stem: "She was ______ (impress) by the young pianist's performance.",
    options: [],
    answer: ["impressed"],
    answerAliases: [["impressed", "very impressed"]],
    explanation: "主语 She 是感受者，使用 -ed 形式的形容词 impressed，构成 be impressed by 结构。",
    knowledgePoints: ["词形变化", "核心词汇"],
    tags: ["语法填空"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-vocab-3",
    bankId: "bank-vocab",
    rootBankId: "bank-root-english",
    type: "judge",
    stem: "“look forward to” 中的 to 是动词不定式符号，后面应接动词原形。",
    options: [],
    answer: ["false"],
    answerAliases: [],
    explanation: "look forward to 中的 to 是介词，后面应接名词、代词或动名词（-ing 形式）。",
    knowledgePoints: ["固定搭配", "核心词汇"],
    tags: ["判断"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 3
  }),
  q({
    id: "q-reading-1",
    bankId: "bank-reading",
    rootBankId: "bank-root-english",
    type: "single",
    stem: "阅读理解中，询问文章中心思想的题干通常不会出现下列哪一项？",
    options: [
      { key: "A", text: "main idea" },
      { key: "B", text: "best title" },
      { key: "C", text: "according to the passage" },
      { key: "D", text: "the author's purpose" }
    ],
    answer: ["C"],
    answerAliases: [],
    explanation: "“according to the passage”通常用于细节题定位；主旨题常见表述包括 main idea、best title 和 author's purpose。",
    knowledgePoints: ["主旨题", "阅读理解"],
    tags: ["题型辨析"],
    difficulty: 2,
    source: "演示题库",
    sortIndex: 1
  }),
  q({
    id: "q-reading-2",
    bankId: "bank-reading",
    rootBankId: "bank-root-english",
    type: "multiple",
    stem: "下列属于阅读常见答题步骤的有：",
    options: [
      { key: "A", text: "先读题干关键词，再回原文定位" },
      { key: "B", text: "警惕绝对化表述与偷换概念" },
      { key: "C", text: "仅凭个人常识直接作答" },
      { key: "D", text: "注意转折词后的作者态度" }
    ],
    answer: ["A", "B", "D"],
    answerAliases: [],
    explanation: "阅读理解需以原文为依据，C 项脱离文本，是错误的答题习惯。",
    knowledgePoints: ["答题策略", "阅读理解"],
    tags: ["多选"],
    difficulty: 1,
    source: "演示题库",
    sortIndex: 2
  }),
  q({
    id: "q-reading-3",
    bankId: "bank-reading",
    rootBankId: "bank-root-english",
    type: "fill",
    stem: "The word “sustainable” in the passage most probably means “____”。",
    options: [],
    answer: ["able to continue"],
    answerAliases: [["able to continue", "可持续的", "that can continue"]],
    explanation: "结合语境，sustainable 表示“可持续的、能够维持下去的”，即 able to continue over time。",
    knowledgePoints: ["词义猜测", "阅读理解"],
    tags: ["填空"],
    difficulty: 3,
    source: "演示题库",
    sortIndex: 3
  })
];

export const seedExam: ExamTemplate = {
  id: "exam-demo",
  name: "20 分钟综合模拟",
  durationMinutes: 20,
  blueprint: [
    { bankId: "bank-verbal", single: 1, multiple: 1, judge: 1, fill: 1 },
    { bankId: "bank-math", single: 1, multiple: 1, judge: 0, fill: 1 },
    { bankId: "bank-common", single: 1, multiple: 0, judge: 1, fill: 0 }
  ],
  shuffleQuestions: true,
  shuffleOptions: false,
  scorePerType: {
    single: 1,
    multiple: 2,
    judge: 1,
    fill: 2
  },
  createdAt
};

const defaultSettings = {
  theme: "system" as const,
  autoNext: false,
  weightedWrongStrength: 2,
  weightedKnowledgeStrength: 3,
  reviewDailyTarget: 30
};

const createEmptyState = (): AppState => ({
  schemaVersion: 2,
  banks: [],
  questions: [],
  records: [],
  wrongs: [],
  notes: [],
  exams: [],
  examSessions: [],
  practiceSession: null,
  settings: { ...defaultSettings }
});

/**
 * 首次启动 / 无本地数据时的初始状态。
 * `VITE_EMPTY_STATE=true` 构建（npm run build:empty）会跳过演示题库，得到空白版本。
 */
export const createSeedState = (): AppState => {
  if (import.meta.env.VITE_EMPTY_STATE === "true") return createEmptyState();
  return {
    schemaVersion: 2,
    banks: seedBanks,
    questions: seedQuestions,
    records: [],
    wrongs: [],
    notes: [],
    exams: [seedExam],
    examSessions: [],
    practiceSession: null,
    settings: { ...defaultSettings }
  };
};
