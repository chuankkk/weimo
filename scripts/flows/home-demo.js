/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(800);

const key = "shuati-wang-state-v1";
const state = JSON.parse(localStorage.getItem(key));
const now = Date.now();
const questions = state.questions ?? [];
const records = [];
const wrongs = [];
const modes = ["sequence", "random", "weighted", "exam"];

questions.slice(0, 16).forEach((question, index) => {
  const dayOffset = 13 - Math.min(13, index);
  const at = new Date(now - dayOffset * 86400000 - 3600000).toISOString();
  const correct = index % 3 !== 0;
  records.push({
    id: `home-record-${index}`,
    questionId: question.id,
    sessionId: "home-demo",
    mode: modes[index % modes.length],
    userAnswer: question.answer,
    isCorrect: correct,
    score: correct ? 1 : 0,
    timeSpentMs: 18000 + index * 900,
    answeredAt: at
  });
  if (!correct && wrongs.length < 7) {
    wrongs.push({
      questionId: question.id,
      wrongCount: 1 + (index % 3),
      correctAfterWrongCount: index % 2,
      lastWrongAt: at,
      lastCorrectAt: index % 2 ? new Date(now - 7200000).toISOString() : undefined,
      masteryLevel: index % 4,
      wrongReasons: [],
      status: index === 3 ? "mastered" : "active",
      nextReviewAt:
        index === 3 ? new Date(now + 86400000 * 20).toISOString() : new Date(now - 3600000 * (index + 1)).toISOString()
    });
  }
});

const practiceQuestions = questions.slice(0, 10);
const practiceAnswers = {};
const practiceSubmitted = {};
practiceQuestions.slice(0, 3).forEach((question) => {
  practiceAnswers[question.id] = question.answer;
  practiceSubmitted[question.id] = true;
});

state.records = records;
state.wrongs = wrongs;
state.notes = questions.slice(0, 2).map((question, index) => ({
  id: `home-note-${index}`,
  questionId: question.id,
  content: index === 0 ? "注意先定位主语，再判断搭配。" : "公式记牢：先化简，再代入。",
  updatedAt: new Date(now - 3600000 * (index + 1)).toISOString()
}));
state.practiceSession = {
  id: "home-demo-practice",
  mode: "weighted",
  questionIds: practiceQuestions.map((question) => question.id),
  currentIndex: 3,
  answers: practiceAnswers,
  submitted: practiceSubmitted,
  startedAt: new Date(now - 20 * 60000).toISOString(),
  questionStartedAt: new Date(now - 2 * 60000).toISOString()
};

const setItem = localStorage.setItem.bind(localStorage);
setItem(key, JSON.stringify(state));
// 阻止卸载时的 pagehide flush 用内存旧状态覆盖演示数据
localStorage.setItem = (name, value) => {
  if (name !== key) setItem(name, value);
};
location.hash = "#/home";
setTimeout(() => location.reload(), 120);
return "home demo seeded";
