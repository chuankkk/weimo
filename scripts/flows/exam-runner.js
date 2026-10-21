/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!location.hash.includes("/exam")) location.hash = "#/exam";
await sleep(700);
document.querySelector(".exam-hero-actions .btn")?.click();
await sleep(900);
document.querySelector(".option")?.click();
await sleep(250);

