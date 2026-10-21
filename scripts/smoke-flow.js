/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = [];
const check = (name, ok, detail = "") => report.push({ name, ok: Boolean(ok), detail });

const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? "";
const clickText = (selector, value) =>
  [...document.querySelectorAll(selector)].find((element) => element.textContent.includes(value));

const setInput = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

try {
  check("首页标题", document.querySelector(".hero-copy h1")?.textContent.includes("落笔有声"));
  check("底部导航", document.querySelectorAll(".nav-item").length === 6);

  // 练习：配置 → 作答 → 总结
  location.hash = "#/practice";
  await sleep(500);
  document.querySelectorAll(".mode-card")[2]?.click();
  await sleep(150);
  document.querySelector(".sticky-bar .btn")?.click();
  await sleep(700);
  check("进入练习", Boolean(document.querySelector(".runner-page")));

  let guard = 0;
  while (!document.querySelector(".summary-page") && guard < 40) {
    guard += 1;
    const option = document.querySelector(".option:not([disabled])");
    const fill = document.querySelector(".fill-field input:not([disabled])");
    if (fill) setInput(fill, "示例答案");
    else if (option) option.click();
    await sleep(120);
    const primary = document.querySelector(".runner-primary:not([disabled])");
    if (primary) {
      primary.click();
      await sleep(220);
      const next = document.querySelector(".runner-primary:not([disabled])");
      if (next) {
        next.click();
        await sleep(260);
      }
    } else {
      break;
    }
  }
  check("练习完成进入总结", Boolean(document.querySelector(".summary-page")), `轮次 ${guard}`);
  check("总结正确率", /%$/.test(text(".summary-ring .ring-content strong")));

  location.hash = "#/wrong";
  await sleep(450);
  check(
    "错题本页面",
    Boolean(document.querySelector(".wrong-page")) &&
      (Boolean(document.querySelector(".wrong-card")) || Boolean(document.querySelector(".empty-state")))
  );

  // 题库：目录 → 详情 → 展开题目 → 导入视图
  location.hash = "#/banks";
  await sleep(500);
  check("题库卡片", document.querySelectorAll(".bank-card").length > 0);
  document.querySelector(".bank-card")?.click();
  await sleep(500);
  check("题库详情", Boolean(document.querySelector(".bank-detail-page")));
  document.querySelector(".question-line-main")?.click();
  await sleep(250);
  check("题目展开", Boolean(document.querySelector(".question-expand")));
  location.hash = "#/banks";
  await sleep(450);
  clickText(".segment", "导入导出")?.click();
  await sleep(450);
  check("导入视图", Boolean(document.querySelector(".drop-zone")));

  // 我的：切换夜墨再切回日宣
  location.hash = "#/settings";
  await sleep(500);
  const themeCards = document.querySelectorAll(".theme-card");
  themeCards[2]?.click();
  await sleep(350);
  check("夜墨模式", document.documentElement.dataset.theme === "dark");
  themeCards[1]?.click();
  await sleep(350);
  check("日宣模式", document.documentElement.dataset.theme === "light");

  // 考试：开始 → 答题卡 → 退出 → 放弃
  location.hash = "#/exam";
  await sleep(500);
  document.querySelector(".exam-hero-actions .btn")?.click();
  await sleep(700);
  const inExam = Boolean(document.querySelector(".exam-runner"));
  check("进入考试", inExam);
  document.querySelector(".option")?.click();
  await sleep(150);
  document.querySelector(".runner-actions .btn:nth-child(2)")?.click();
  await sleep(400);
  check("答题卡", Boolean(document.querySelector(".sheet-grid")));
  [...document.querySelectorAll(".modal-foot .btn")].find((b) => b.textContent.includes("继续作答"))?.click();
  await sleep(300);
  document.querySelector(".runner-bar .icon-btn")?.click();
  await sleep(350);
  const dialogs = [...document.querySelectorAll(".modal")];
  const exitDialog = dialogs[dialogs.length - 1];
  [...(exitDialog?.querySelectorAll(".modal-foot .btn") ?? [])].find((b) => b.textContent.includes("退出考试"))?.click();
  await sleep(500);
  check("退出后回到考试页", Boolean(document.querySelector(".exam-resume")) || Boolean(document.querySelector(".exam-hero")));

  // 导入：CSV（含引号内逗号） → 完整备份恢复 → 回收站恢复
  const upload = (name, content, type) => {
    const file = new File([content], name, { type });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('.drop-zone input[type="file"]');
    if (!input) return false;
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  location.hash = "#/banks?view=import";
  await sleep(600);
  const csv = [
    "\uFEFF大题库,小题库,题型,题干,选项A,选项B,选项C,选项D,答案,解析",
    '导入测试库,第一章,单选,"含,逗号的题干",选项一,选项二,选项三,选项四,A,这是解析'
  ].join("\r\n");
  upload("smoke-import.csv", csv, "text/csv");
  await sleep(1000);
  const csvReport = document.querySelector(".import-report")?.textContent ?? "";
  check("CSV 导入", /新增\s*1/.test(csvReport), csvReport.slice(0, 60));

  const now = new Date().toISOString();
  const backup = {
    schemaVersion: 2,
    banks: [
      {
        id: "smoke-restore-bank",
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
        id: "smoke-restore-q1",
        bankId: "smoke-restore-bank",
        rootBankId: "smoke-restore-bank",
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
        fingerprint: "smoke-restore-fp"
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
  upload("smoke-restore.json", JSON.stringify(backup), "application/json");
  await sleep(800);
  [...document.querySelectorAll(".modal-foot .btn")].find((button) => button.textContent.includes("覆盖并恢复"))?.click();
  await sleep(800);
  location.hash = "#/banks";
  await sleep(450);
  const restoredNames = [...document.querySelectorAll(".bank-card-title strong")].map((element) => element.textContent.trim());
  check("完整备份恢复", restoredNames.includes("恢复测试库"), restoredNames.join(","));

  document.querySelector(".bank-card")?.click();
  await sleep(450);
  const deleteButtons = document.querySelectorAll(".detail-head-actions .icon-btn");
  deleteButtons[deleteButtons.length - 1]?.click();
  await sleep(350);
  [...document.querySelectorAll(".modal-foot .btn")].find((button) => button.textContent.includes("移入回收站"))?.click();
  await sleep(600);
  check("进入回收站", document.querySelectorAll(".trash-card").length === 1);
  document.querySelector(".trash-actions .btn")?.click();
  await sleep(600);
  location.hash = "#/banks";
  await sleep(450);
  const bankCountAfterRestore = document.querySelectorAll(".bank-card").length;
  check("回收站恢复", bankCountAfterRestore === 1, `题库数 ${bankCountAfterRestore}`);

  const errors = window.__uiErrors ?? [];
  check("无运行时错误", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("脚本异常", false, String(error));
}

return { passed: report.filter((item) => item.ok).length, total: report.length, report };

