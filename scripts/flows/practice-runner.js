/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!location.hash.includes("/practice")) location.hash = "#/practice";
await sleep(600);

const modes = document.querySelectorAll(".mode-card");
modes[2]?.click();
await sleep(200);

document.querySelector(".sticky-bar .btn")?.click();
await sleep(800);

document.querySelector(".option")?.click();
await sleep(250);

document.querySelector(".runner-primary")?.click();
await sleep(600);

