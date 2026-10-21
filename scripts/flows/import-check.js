/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
location.hash = "#/banks?view=import";
await sleep(700);

const csv = [
  "\uFEFF大题库,小题库,题型,题干,选项A,选项B,选项C,选项D,答案,解析",
  '导入测试库,第一章,单选,"含,逗号的题干",选项一,选项二,选项三,选项四,A,这是解析'
].join("\r\n");
const file = new File([csv], "import-test.csv", { type: "text/csv" });
const transfer = new DataTransfer();
transfer.items.add(file);
const input = document.querySelector('.drop-zone input[type="file"]');
input.files = transfer.files;
input.dispatchEvent(new Event("change", { bubbles: true }));
await sleep(1200);

const reportText = document.querySelector(".import-report")?.textContent ?? "";
const imported = /新增\s*1/.test(reportText);
const hasError = document.querySelector(".import-report .is-error") !== null;

location.hash = "#/banks";
await sleep(500);
const bankNames = [...document.querySelectorAll(".bank-card-title strong")].map((element) => element.textContent.trim());
const navigated = bankNames.includes("导入测试库");
document.querySelector(".bank-card")?.click();
await sleep(400);

return { imported, hasError, reportText: reportText.slice(0, 120), bankNames, navigated };
