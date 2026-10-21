/* ui-shot 页面脚本：由 scripts/ui-shot.mjs --script 注入执行，支持顶层 await 与 return。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const routes = ["home", "banks", "practice", "wrong", "exam", "settings"];
const report = {};
for (const route of routes) {
  location.hash = `#/${route}`;
  await sleep(450);
  const buttons = [...document.querySelectorAll("button")];
  const unnamedButtons = buttons
    .filter((button) => {
      const name =
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.textContent.trim() ||
        button.querySelector("img[alt]:not([alt=''])");
      return !name;
    })
    .map((button) => button.className || button.outerHTML.slice(0, 60));
  const fields = [...document.querySelectorAll("input, select, textarea")];
  const unlabeledFields = fields
    .filter((field) => {
      if (field.getAttribute("aria-label")) return false;
      if (field.closest("label")) return false;
      if (field.id && document.querySelector(`label[for="${field.id}"]`)) return false;
      if (field.type === "hidden" || field.type === "file") return false;
      return true;
    })
    .map((field) => `${field.tagName.toLowerCase()}.${field.className}`);
  const imagesWithoutAlt = [...document.querySelectorAll("img")].filter((img) => !img.hasAttribute("alt")).length;
  const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  report[route] = { unnamedButtons, unlabeledFields, imagesWithoutAlt, duplicateIds: [...new Set(duplicateIds)] };
}
return report;

