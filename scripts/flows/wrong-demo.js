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
  const at = new Date(now - (13 - Math.min(13, index)) * 86400000 + 3600000).toISOString();
  const correct = index % 3 !== 0;
  records.push({
    id: `demo-record-${index}`,
    questionId: question.id,
    sessionId: "demo-session",
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
      lastCorrectAt: index % 2 ? new Date(now - 3600000).toISOString() : undefined,
      masteryLevel: index % 4,
      wrongReasons: [],
      status: index === 3 ? "mastered" : index === 4 ? "ignored" : "active",
      nextReviewAt: index === 3 ? new Date(now + 86400000 * 20).toISOString() : new Date(now - 3600000 * (index + 1)).toISOString()
    });
  }
});

state.records = records;
state.wrongs = wrongs;
state.notes = questions.slice(0, 2).map((question, index) => ({
  id: `demo-note-${index}`,
  questionId: question.id,
  content: index === 0 ? "注意先定位主语，再判断搭配。" : "公式记牢：先化简，再代入。",
  updatedAt: new Date(now - 3600000 * (index + 1)).toISOString()
}));
const setItem = localStorage.setItem.bind(localStorage);
setItem(key, JSON.stringify(state));
// 阻止页面卸载时的 pagehide flush 用内存中的旧状态覆盖演示数据。
localStorage.setItem = (name, value) => {
  if (name !== key) setItem(name, value);
};
location.hash = "#/wrong";
setTimeout(() => location.reload(), 120);
return "demo seeded";

