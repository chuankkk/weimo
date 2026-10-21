/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const routes = ["home", "banks", "practice", "wrong", "exam", "settings"];
const report = {};
for (const route of routes) {
  location.hash = `#/${route}`;
  await sleep(450);
  const root = document.documentElement;
  const page = document.querySelector(".page");
  const offenders = [...document.querySelectorAll(".page *")]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
    })
    .slice(0, 5)
    .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]}`);
  report[route] = {
    viewport: window.innerWidth,
    scrollWidth: root.scrollWidth,
    pageScrollWidth: page?.scrollWidth ?? null,
    overflow: root.scrollWidth > window.innerWidth + 1,
    offenders
  };
}
return report;

