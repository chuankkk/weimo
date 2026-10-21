/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
location.hash = "#/banks?view=import";
await sleep(700);

const now = new Date().toISOString();
const backup = {
  schemaVersion: 2,
  banks: [
    {
      id: "restore-bank",
      name: "恢复测试库",
      description: "备份恢复验证",
      sortIndex: 1,
      color: "#2C4B43",
      createdAt: now,
      updatedAt: now
    }
  ],
  questions: [
    {
      id: "restore-q1",
      bankId: "restore-bank",
      rootBankId: "restore-bank",
      type: "judge",
      stem: "备份恢复后的判断题。",
      options: [],
      answer: ["true"],
      answerAliases: [],
      explanation: "恢复测试",
      knowledgePoints: ["恢复"],
      tags: [],
      difficulty: 2,
      source: "备份测试",
      sortIndex: 1,
      createdAt: now,
      updatedAt: now,
      fingerprint: "restore-fp"
    }
  ],
  records: [],
  wrongs: [],
  notes: [],
  exams: [],
  examSessions: [],
  practiceSession: null,
  trash: [],
  settings: {
    theme: "light",
    autoNext: false,
    weightedWrongStrength: 2,
    weightedKnowledgeStrength: 3,
    reviewDailyTarget: 30
  }
};

const file = new File([JSON.stringify(backup)], "restore-test.json", { type: "application/json" });
const transfer = new DataTransfer();
transfer.items.add(file);
const input = document.querySelector('.drop-zone input[type="file"]');
input.files = transfer.files;
input.dispatchEvent(new Event("change", { bubbles: true }));
await sleep(900);

const confirmButtons = [...document.querySelectorAll(".modal-foot .btn")];
const confirmTitle = document.querySelector(".modal-head h2")?.textContent ?? "";
confirmButtons.find((button) => button.textContent.includes("覆盖并恢复"))?.click();
await sleep(900);

location.hash = "#/banks";
await sleep(500);
const names = [...document.querySelectorAll(".bank-card-title strong")].map((element) => element.textContent.trim());
return { confirmTitle, restored: names.includes("恢复测试库"), names };
