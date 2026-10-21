# 验证脚本

这些脚本只依赖 Node 22+ 与一个本机 Chromium 内核浏览器（Chrome / Edge），不需要 Playwright、Puppeteer 或额外 npm 包。

## 一键验证

```bash
npm test        # 纯逻辑回归（rolldown 打包 tests/logic.test.ts 后由 node 执行）
npm run verify  # npm test + npm run smoke
```

`npm run smoke` 会先构建，再复用 `http://127.0.0.1:4173/` 或自行启动预览服务，最后用 Chrome DevTools Protocol 跑完 `scripts/smoke-flow.js` 的 20 项交互检查并自动清理进程。

## 截图

```bash
npm run preview
npm run ui:shot -- --url http://localhost:4173/ --out artifacts/ui/home.png --width 412 --height 915 --dpr 2 --full-page
npm run ui:shot -- --url http://localhost:4173/ --out artifacts/ui/home-dark.png --dark --full-page
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `--width` / `--height` / `--dpr` | 视口与像素比，默认 412×915@2x |
| `--full-page` | 截取完整页面（固定底栏会停留在首屏位置） |
| `--dark` | 模拟 `prefers-color-scheme: dark` |
| `--script <file>` | 页面加载后执行脚本，支持顶层 `await` 与 `return` |
| `--keep-open` | 截图后保留浏览器，调试用 |

## 可复用页面脚本（scripts/flows）

| 脚本 | 作用 |
| --- | --- |
| `practice-runner.js` | 配置一组智能练习并停在作答页 |
| `practice-summary.js` | 写入已完成练习并打开总结页 |
| `home-demo.js` | 写入近两周记录、错题、笔记与未完成练习，生成有数据的首页 |
| `wrong-demo.js` | 写入错题数据并打开错题本 |
| `exam-runner.js` / `exam-report.js` | 开始考试、答题卡、交卷并打开报告 |
| `import-check.js` | 上传含引号内逗号的 CSV，检查导入报告 |
| `backup-check.js` | 导入完整备份 JSON，验证覆盖恢复 |
| `trash-check.js` | 删除题库、检查回收站并恢复 |
| `a11y-check.js` / `overflow-check.js` | 扫描无名称按钮、未关联字段、重复 id 与横向溢出 |

示例：

```bash
node scripts/ui-shot.mjs --url http://localhost:4173/ \
  --out artifacts/ui/demo-home.png --full-page \
  --script scripts/flows/home-demo.js
```

脚本在页面上下文执行，可直接使用 `document`、`localStorage` 与 `await`。
