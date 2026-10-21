/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!location.hash.includes("/exam")) location.hash = "#/exam";
await sleep(700);
document.querySelector(".exam-hero-actions .btn")?.click();
await sleep(900);
document.querySelector(".option")?.click();
await sleep(250);
document.querySelector(".runner-actions .btn:nth-child(2)")?.click();
await sleep(500);
 [...document.querySelectorAll(".modal-foot .btn")].find((button) => button.textContent.includes("交卷"))?.click();
await sleep(500);
const dialogs = [...document.querySelectorAll(".modal")];
const confirmDialog = dialogs[dialogs.length - 1];
[...(confirmDialog?.querySelectorAll(".modal-foot .btn") ?? [])].find((button) => button.textContent.trim() === "交卷")?.click();
await sleep(900);

