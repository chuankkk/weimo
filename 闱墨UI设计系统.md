# 闱墨 UI 设计系统

更新时间：2026-10-21 · 版本 2.0

## 1. 品牌定位

“闱墨”取“闱场、墨卷、研习”之意。设计不采用堆叠竹子、祥云、毛笔等装饰性古风符号，而以现代信息层级承载中国水墨的留白、纸感与克制。

品牌语：**一卷一答，墨见真知。**

品牌图形由三部分构成：

1. 门形外框：提取“闱”的门部，形成稳定轮廓。
2. 卷页负形：表达题卷、阅读与本地知识库。
3. 朱砂点：对应批注、确认和品牌记忆点。

## 2. 设计原则

1. 先阅读，后装饰：题干、选项和解析永远优先。
2. 纸面分层：普通卡片用明度与界格线分层，阴影只给底栏、浮层和固定操作条。
3. 墨分五色：状态色低饱和，并始终配合文字或图标。
4. 现代用语：保留“开始练习、导入、错题”等直白功能词。
5. 沉浸作答：进入练习或考试后隐藏全局导航，减少误触。
6. 双端一体：移动端底部导航，桌面端同一套导航变为左侧书签栏。
7. 可恢复：退出、刷新、误触都不应该丢失正在进行的练习或考试。

## 3. 设计令牌

| 语义 | 日宣 | 夜墨 | 用途 |
| --- | --- | --- | --- |
| 宣纸底 | `#F5F0E6` | `#111412` | 页面背景 |
| 素笺面 | `#FBF8F1` | `#1A1E1B` | 卡片、输入区 |
| 纸笺浮层 | `#FFFDF8` | `#222723` | 输入框、浮起卡片 |
| 玄墨 | `#1C1F1C` | `#F1EADC` | 主文字 |
| 淡墨 | `#6D736C` | `#A9A294` | 辅助文字 |
| 界格线 | `#DED5C6` | `#343A34` | 分割与边框 |
| 黛青 | `#2C4B43` | `#A6BFB1` | 主操作、选中 |
| 朱砂 | `#A8463A` | `#DE9482` | 品牌点、错误、危险 |
| 金泥 | `#86662F` | `#CFB079` | 指标单位、少量强调 |
| 松绿 | `#3F6657` | `#93BBA7` | 正确、完成 |

- 间距采用 4px 基线：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`。
- 圆角：控件 `10px`、卡片 `14px`、大面板 `22px`、卷首 `28px`。
- 阴影：普通卡片只有极轻分层；底栏、弹层、固定操作条使用 `--shadow-md` / `--shadow-lg`。
- 纸纹：`body::before` 使用低透明度 SVG 噪点，夜墨模式改用 `soft-light`，避免脏灰。

## 4. 字体与图标

- 品牌字、页面标题、题干、指标数字：Noto Serif SC Variable。
- 正文、按钮、表单、标签：Noto Sans SC Variable。
- 字体通过 Fontsource 随包部署，不依赖在线 CDN；中文按 unicode-range 分片，浏览器只下载实际使用的字形。
- 指标数字使用 `tabular-nums`；题干行高约 1.78，优先保证长题可读性。
- 功能图标使用 Lucide，统一单色、1.7 线宽和 14/18/20 三档尺寸。
- 底栏选中态使用黛青底与顶部朱砂点；桌面侧栏使用左侧黛青线。
- 首页入口使用素笺图标框与朱砂落点。

## 5. 核心组件

### 卷首

首页卷首以水墨门庭为右侧主视觉，左侧是品牌、日期、标题与双行动按钮；右侧一个半透明“今日目标”环形卡，显示今日练习量与连续天数。主视觉使用 JPEG + 1200px 响应式版本，并预加载。

### 学习概览

四张指标卡改为独立纸卡：题目总量、综合正确率、连续练习、待复习。数字用宋体与金色单位，配一行极短说明。

### 活跃度与薄弱知识点

- 近 14 天活跃度用细柱状图：普通日黛青，今日朱砂；只标注首日、第七日与今日，避免拥挤。
- 薄弱知识点按错误率列出名称、进度条和“答错 / 总次数”；无数据时显示目标图形与引导。
- 最近作答用“对 / 误”朱砂或松绿小方章，明确结果而不抢阅读。

### 题库册页

题库颜色为低饱和书脊条；卡片突出题量、子库、错题与题型分布细墨条。桌面端两列，移动端单列。题库详情把题干、题型、知识点、已练状态放进分页索引；展开后显示答案、解析、来源和编辑/删除操作。

### 页内导航

长页面在标题下或首屏后放置一条粘性页内导航：首页（开始学习 / 学习动态 / 最近作答 / 题库概览）、练习配置（练习模式 / 抽题范围 / 题型与数量）、模拟考试（策略库 / 组卷设置 / 考试记录）、我的（外观 / 学习偏好 / 数据 / 维护）、考试报告（成绩 / 题型表现 / 逐题回顾）。点击平滑定位到对应小节，右侧箭头回到顶部；滚动时用 IntersectionObserver 同步当前小节。移动端空间不足时导航横向滚动，不改变页面纵向结构。

### 练习模式与抽题范围

四种模式保留 2×2 / 4 列布局。选中态同时使用左侧黛青线、底色和右上角选中图标，不只依赖颜色。抽题范围支持一级题库和子库复选；桌面两列，移动端单列。底部固定操作条显示本次题量、预计时长和主按钮。

### 作答与批注

题干使用宋体和宽行高，填空下划线改为朱砂细线。选项字母使用方形题签；提交后正确项为松绿、错误项为朱砂，并在字母位显示对勾/叉号。解析面板以“批注”语义呈现，带“对 / 误”小方章、正确答案、你的答案和解析；下方是自动带出的个人笔记。

### 练习总结

完成后进入独立总结页：大环形正确率、标题式评语、用时、正确/待巩固统计、再练一组/重做错题/返回首页，以及逐题回顾。

### 模拟考试

- 深黛“当前组卷”卡显示题量、范围、时长和满分；印章式“闱”作为水印。
- 策略库复用卡、倒计时运行态、答题卡底部抽屉、逐题回顾报告共用一套纸面与状态色。
- 考试运行态顶部固定“剩余时间”，低于 5 分钟转朱砂；答题卡用网格与四种状态（已答/未答/标记/当前）。
- 报告页用大环形正确率、题型表现条和复盘提示；逐题回顾可展开答案、选项和解析。

### 我的

品牌卡显示应用名、版本、平台、题库/题目/记录统计。外观三张迷你预览卡（跟随系统/日宣/夜墨）；学习偏好用开关、步进器与滑杆；数据区使用拖放导入、四个导出入口、存储占用和维护操作。

### 底部导航 / 桌面侧栏

- 移动端：六等分磨砂底栏，顶部居中的朱砂点标记当前位置；错题角标显示今日待复习数。
- 桌面 ≥1100px：同一导航变为 244px 左侧书签栏，含品牌、纵向导航与“本地题库·数据留在本机”页脚；内容居中，最大 1000px。
- 练习/考试沉浸态隐藏导航。

## 6. 页面布局

- 首页：卷首、页内导航、指标、开始学习、学习动态（手机端练习活跃度/薄弱知识点切换）、最近作答、题库概览、页脚说明。
- 题库：目录 / 导入导出 / 合并 / 回收站四段；目录两列卡片，详情为“头部 + 指标 + 子库 + 题型分布 + 搜索 + 分页索引”；删除与合并进入回收站，可恢复或撤销。
- 练习：未开始为配置页（页内导航、断点卡、模式、范围、题型、数量、固定开始条）；运行态为沉浸答题页，提交后可左右滑动切题；结束态为总结页。
- 错题：总览、状态分段、题库/关键词筛选、错题卡、答案解析展开与操作；列表每批 20 条增量加载；可按题库导出 A4 错题本（含笔记、答案与解析）。
- 考试：组卷摘要、进行中提示、页内导航、策略库、组卷设置、题型数量、固定开始条、考试记录。
- 我的：品牌卡、页内导航、外观、学习偏好、数据、维护、关于。
- 考试报告：报告头部、页内导航、成绩、题型表现、复盘提示、逐题回顾。

## 7. 响应式与无障碍

- 验证宽度：320、412、760、1100、1440px。
- 手机水平留白 15–20px，触控目标至少 44px；320px 下无横向溢出。
- 长页面使用粘性页内导航，导航自身可横向滚动，避免在窄屏挤压标题。
- 使用 `aria-current`、`aria-pressed`、`aria-expanded`、可见焦点和焦点陷阱。
- 支持安全区 `env(safe-area-inset-*)`。
- 支持 `prefers-reduced-motion`：关闭页面淡入、答案浮入和进度动画。
- 练习和考试运行时移除底栏，固定操作区避开安全区；桌面端固定操作条居中于 780px 阅读区。

## 8. 品牌资源

- `public/assets/weimo-mark.svg`：应用内品牌标志。
- `public/assets/weimo-ink-hero.jpg`：首页水墨卷首主视觉（1672×941，243 KB）。
- `public/assets/weimo-ink-hero-1200.jpg`：1200px 响应式版本（115 KB）。
- `public/assets/app-icon-192.png`、`app-icon-512.png`：PWA 图标。
- `android/app/src/main/res/mipmap-*`：Android launcher / round / foreground。
- `android/app/src/main/res/drawable*/splash.png`：横竖屏启动页。

水墨主视觉最终提示词：

```text
Use case: stylized-concept
Asset type: mobile app home hero background for a premium Chinese study app
Primary request: a high-end contemporary Chinese ink-wash illustration inspired by imperial examination courtyards and quiet scholarly study, with an abstract gate silhouette, distant layered mountains, and one restrained cinnabar seal-like square with no writing
Scene/backdrop: warm ivory xuan rice paper with subtle natural fibers and generous calm space
Style/medium: refined Chinese shuimo ink wash, museum-catalog editorial restraint, expressive dry-brush edges, delicate diluted ink blooms, contemporary minimalism
Composition/framing: wide landscape composition; keep the left 55% quiet and pale for UI copy, concentrate the strongest ink forms and gate silhouette on the right 45%; readable when center-cropped on a portrait phone
Lighting/mood: soft mist, contemplative, scholarly, premium, timeless
Color palette: warm ivory, soot black, blue-grey ink, one very small muted cinnabar accent
Materials/textures: authentic rice-paper grain, dry brush, watery ink diffusion
Constraints: no text, no Chinese characters, no logos, no people, no watermark; no 3D rendering, no glossy objects, no UI mockup, no photorealism, no bright teal, no saturated gradients; preserve ample negative space and a clean silhouette for mobile use
```

## 9. 验收证据

视觉验收图位于 `docs/screenshots/`：

- `home-mobile.png`、`home-full.png`、`home-desktop.png`
- `home-empty.png`、`night-theme.png`、`settings-dark.png`
- `banks-mobile.png`、`bank-detail.png`
- `trash-mobile.png`、`trash-desktop.png`
- `practice-setup.png`、`practice-runner.png`、`practice-summary.png`
- `wrong-mobile.png`
- `wrongbook-preview.png`
- `exam-planner.png`、`exam-runner.png`、`exam-report.png`
- `settings-mobile.png`
- `android-runtime.png`、`android-empty.png`（Android 模拟器 1080×2400）
- `home-baseline.png`（首页视觉基线）

工程验收：`npx tsc --noEmit`、`npm run build`、生产预览加载；交互冒烟覆盖练习完成、断点续做、左右滑动切题、题库删除/恢复、合并撤销、回收站彻底删除、按题库导出错题本/笔记、考试自动交卷、答题卡交卷、报告、CSV 导入、完整备份恢复、Excel 导出与主题切换。
