/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(800);

const key = "shuati-wang-state-v1";
const state = JSON.parse(localStorage.getItem(key));
const now = Date.now();
const questions = state.questions ?? [];
const picked = questions.slice(0, 8);
const sessionId = "demo-summary";
const answers = {};
const submitted = {};
const records = picked.map((question, index) => {
  const at = new Date(now - (8 - index) * 60000).toISOString();
  answers[question.id] = question.answer;
  submitted[question.id] = true;
  return {
    id: `summary-record-${index}`,
    questionId: question.id,
    sessionId,
    mode: "weighted",
    userAnswer: question.answer,
    isCorrect: index < 6,
    score: index < 6 ? 1 : 0,
    timeSpentMs: 16000 + index * 1200,
    answeredAt: at
  };
});
state.records = records;
state.wrongs = [];
state.notes = [];
state.practiceSession = {
  id: sessionId,
  mode: "weighted",
  questionIds: picked.map((question) => question.id),
  currentIndex: picked.length - 1,
  answers,
  submitted,
  startedAt: new Date(now - 8 * 60000).toISOString(),
  questionStartedAt: new Date(now - 60000).toISOString(),
  completedAt: new Date(now).toISOString()
};
const setItem = localStorage.setItem.bind(localStorage);
setItem(key, JSON.stringify(state));
localStorage.setItem = (name, value) => {
  if (name !== key) setItem(name, value);
};
location.hash = "#/practice?run=1";
setTimeout(() => location.reload(), 120);
return "summary seeded";

