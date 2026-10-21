#!/usr/bin/env node
/**
 * 无依赖 UI 截图 / 冒烟工具。
 *
 * 通过 Chrome DevTools Protocol 驱动本机 Chrome：
 *   node scripts/ui-shot.mjs --url http://localhost:4173/ --out artifacts/ui/home.png \
 *     --width 412 --height 915 --dpr 2 --full-page --wait 900
 *
 * 可选：
 *   --script <file>   页面加载后执行的 JS 文件（可返回 Promise，用于点按、导入数据等）
 *   --keep-open       截图后不关闭浏览器（调试用）
 *
 * 依赖：Node 22+（内置 fetch / WebSocket）与本机 Chrome。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : true;
};

const url = flag("url", "http://localhost:4173/");
const out = resolve(flag("out", "artifacts/ui/latest.png"));
const width = Number(flag("width", 412));
const height = Number(flag("height", 915));
const dpr = Number(flag("dpr", 2));
const fullPage = Boolean(flag("full-page", false));
const wait = Number(flag("wait", 900));
const scriptPath = flag("script", null);
const keepOpen = Boolean(flag("keep-open", false));
const dark = Boolean(flag("dark", false));
let cleaned = false;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) throw new Error("未找到 Chrome / Edge 可执行文件");

const port = 9400 + Math.floor(Math.random() * 300);
const profileDir = resolve("artifacts", `.chrome-shot-${process.pid}-${Date.now().toString(36)}`);
mkdirSync(profileDir, { recursive: true });
// 顺手清理历史截图遗留的临时 profile，避免 artifacts 目录累积。
try {
  for (const entry of readdirSync(resolve("artifacts"))) {
    if (entry.startsWith(".chrome-shot-") && resolve("artifacts", entry) !== profileDir) {
      try {
        rmSync(resolve("artifacts", entry), { recursive: true, force: true });
      } catch {
        /* 可能仍被旧进程占用 */
      }
    }
  }
} catch {
  /* artifacts 尚未创建 */
}
mkdirSync(dirname(out), { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--mute-audio",
    "--force-color-profile=srgb",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

const sleepSync = (ms) => {  // 仅用于退出前等待 Chrome 释放文件句柄，不阻塞页面执行。
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* busy wait fallback */
    }
  }
};

const cleanup = () => {
  if (keepOpen || cleaned) return;
  cleaned = true;
  try {
    if (process.platform === "win32" && chrome.pid) {
      spawnSync("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      chrome.kill();
    }
  } catch {
    /* ignore */
  }
  sleepSync(900);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true });
      break;
    } catch {
      sleepSync(500);
    }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

const endpoint = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* browser not ready */
    }
    await delay(100);
  }
  throw new Error("Chrome 调试端口未就绪");
};

const connect = async (wsUrl) => {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePromise, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolvePromise(message.result);
      return;
    }
    if (message.method) {
      for (const listener of listeners.get(message.method) ?? []) listener(message.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolvePromise, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve: resolvePromise, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (method) =>
    new Promise((resolvePromise) => {
      const handler = (params) => {
        listeners.set(
          method,
          (listeners.get(method) ?? []).filter((item) => item !== handler)
        );
        resolvePromise(params);
      };
      listeners.set(method, [...(listeners.get(method) ?? []), handler]);
    });
  return { send, once, close: () => socket.close() };
};

const main = async () => {
  const session = await connect(await endpoint());
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: width < 760
  });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }]
  });

  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__uiErrors = [];
      window.addEventListener("error", (event) => window.__uiErrors.push(String(event.message)));
      window.addEventListener("unhandledrejection", (event) => window.__uiErrors.push(String(event.reason)));`
  });

  const loaded = session.once("Page.loadEventFired");
  await session.send("Page.navigate", { url });
  await loaded;
  await session.send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true
  });

  if (scriptPath) {
    const source = readFileSync(resolve(scriptPath), "utf8");
    const result = await session.send("Runtime.evaluate", {
      expression: `(async () => { ${source} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.result?.value !== undefined) {
      console.log("[script]", JSON.stringify(result.result.value));
    }
    if (result.exceptionDetails) {
      console.error("[script error]", result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      process.exitCode = 1;
    }
  }

  await delay(wait);

  let clip;
  if (fullPage) {
    const metrics = await session.send("Page.getLayoutMetrics");
    const size = metrics.cssContentSize ?? metrics.contentSize;
    clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  }
  const shot = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: fullPage,
    fromSurface: true,
    ...(clip ? { clip } : {})
  });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`saved ${out}`);

  const errors = await session.send("Runtime.evaluate", {
    expression: "JSON.stringify(window.__uiErrors ?? [])",
    returnByValue: true
  });
  if (errors.result?.value && errors.result.value !== "[]") {
    console.error("[page errors]", errors.result.value);
    process.exitCode = 1;
  }

  if (!keepOpen) {
    try {
      await session.send("Browser.close");
    } catch {
      /* 浏览器可能已经关闭连接 */
    }
  }
  session.close();
  cleanup();
  process.exit(process.exitCode ?? 0);
};

main().catch((error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});
