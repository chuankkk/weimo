#!/usr/bin/env node
/**
 * 一键冒烟：构建 → 启动/复用预览服务 → 通过 Chrome DevTools Protocol 跑完整交互流。
 *
 *   npm run smoke
 */
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const run = (command, args, options = {}) => spawnSync(command, args, { stdio: "inherit", ...options });

console.log("▸ 构建生产包");
const build = run(npmCmd, ["run", "build"], { shell: isWindows });
if (build.status !== 0) {
  console.error("构建失败，冒烟中止");
  process.exit(build.status ?? 1);
}

const reachable = async () => {
  try {
    const response = await fetch(BASE);
    return response.ok;
  } catch {
    return false;
  }
};

let server = null;
if (!(await reachable())) {
  console.log("▸ 启动预览服务");
  server = spawn(npmCmd, ["run", "preview", "--", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
    shell: isWindows
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await reachable()) break;
    await delay(250);
  }
  if (!(await reachable())) {
    console.error("预览服务未能启动");
    cleanup();
    process.exit(1);
  }
} else {
  console.log("▸ 复用已运行的预览服务");
}

const shot = resolve("scripts/ui-shot.mjs");
const flow = resolve("scripts/smoke-flow.js");
const result = run(process.execPath, [
  shot,
  "--url",
  BASE,
  "--out",
  resolve("artifacts/ui/smoke.png"),
  "--width",
  "412",
  "--height",
  "915",
  "--dpr",
  "1",
  "--wait",
  "300",
  "--script",
  flow
]);

cleanup();
process.exit(result.status ?? 1);

function cleanup() {
  if (!server) return;
  if (isWindows && server.pid) {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill();
  }
  server = null;
}
