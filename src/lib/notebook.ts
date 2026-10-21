import type { AppState, PracticeRecord, Question, UserNote, WrongQuestion } from "../types";
import type { Catalog } from "./catalog";
import { formatAnswer, formatUserAnswer } from "./text";
import { formatDate, formatTime, relativeTime } from "./date";

export interface WrongBookOptions {
  includeMastered: boolean;
  includeIgnored: boolean;
  includeNotes: boolean;
}

export const defaultWrongBookOptions: WrongBookOptions = {
  includeMastered: false,
  includeIgnored: false,
  includeNotes: true
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const statusLabel: Record<WrongQuestion["status"], string> = {
  active: "待复习",
  mastered: "已掌握",
  ignored: "已忽略"
};

const statusClass: Record<WrongQuestion["status"], string> = {
  active: "is-active",
  mastered: "is-mastered",
  ignored: "is-ignored"
};

const typeLabel: Record<Question["type"], string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
  fill: "填空"
};

const formatStamp = (iso?: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)} ${formatTime(date)}`;
};

const latestRecordFor = (records: PracticeRecord[], questionId: string) => {
  let latest: PracticeRecord | undefined;
  for (const record of records) {
    if (record.questionId !== questionId) continue;
    if (!latest || record.answeredAt.localeCompare(latest.answeredAt) > 0) latest = record;
  }
  return latest;
};

const safeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "题库";

const renderOptions = (question: Question, record?: PracticeRecord) => {
  if (!question.options.length) return "";
  const correct = new Set(question.answer.map((item) => item.toUpperCase()));
  const picked = new Set((record?.userAnswer ?? []).map((item) => item.toUpperCase()));
  return `<ul class="options">${question.options
    .map((option) => {
      const isCorrect = correct.has(option.key);
      const isWrongPick = picked.has(option.key) && !isCorrect;
      return `<li class="option${isCorrect ? " is-correct" : ""}${isWrongPick ? " is-wrong-pick" : ""}">
        <b>${escapeHtml(option.key)}</b><span>${escapeHtml(option.text)}</span>
      </li>`;
    })
    .join("")}</ul>`;
};

const renderNote = (note: UserNote | undefined) => {
  if (!note) return "";
  return `<div class="note-block">
    <div class="note-label">我的笔记 <span>${escapeHtml(relativeTime(note.updatedAt))}</span></div>
    <div class="note-content">${escapeHtml(note.content)}</div>
  </div>`;
};

const renderWrongCard = (
  index: number,
  question: Question,
  wrong: WrongQuestion,
  record: PracticeRecord | undefined,
  note: UserNote | undefined,
  bankPath: string
) => {
  const answer = formatAnswer(question);
  const userAnswer = record ? formatUserAnswer(question, record.userAnswer) : "暂无作答记录";
  const correct = record?.isCorrect;
  return `<article class="wrong-card">
    <div class="card-top">
      <span class="index">${String(index).padStart(2, "0")}</span>
      <span class="type">${typeLabel[question.type]}</span>
      <span class="status ${statusClass[wrong.status]}">${statusLabel[wrong.status]}</span>
      <span class="path">${escapeHtml(bankPath)}</span>
    </div>
    <h3 class="stem">${escapeHtml(question.stem)}</h3>
    ${renderOptions(question, record)}
    <div class="answer-row">
      <span>正确答案</span><strong>${escapeHtml(answer)}</strong>
    </div>
    <div class="answer-row muted">
      <span>最近作答${record ? (correct ? "（正确）" : "（错误）") : ""}</span><strong>${escapeHtml(userAnswer)}</strong>
    </div>
    ${question.explanation ? `<div class="explain"><span>解析</span><p>${escapeHtml(question.explanation)}</p></div>` : ""}
    <div class="wrong-meta">
      <span>答错 ${wrong.wrongCount} 次</span>
      <span>最近答错 ${escapeHtml(formatStamp(wrong.lastWrongAt))}</span>
      <span>掌握度 ${Math.min(5, Math.max(0, wrong.masteryLevel))}/5</span>
      <span>下次复习 ${escapeHtml(formatStamp(wrong.nextReviewAt))}</span>
    </div>
    ${question.knowledgePoints.length ? `<div class="knowledge">${question.knowledgePoints.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>` : ""}
    ${renderNote(note)}
  </article>`;
};

const renderExtraNote = (note: UserNote, question: Question, bankPath: string) => `<article class="note-card">
  <div class="card-top">
    <span class="type">笔记</span>
    <span class="path">${escapeHtml(bankPath)}</span>
    <span class="note-time">${escapeHtml(relativeTime(note.updatedAt))}</span>
  </div>
  <h3 class="stem">${escapeHtml(question.stem)}</h3>
  <div class="note-content">${escapeHtml(note.content)}</div>
  <div class="knowledge">${question.knowledgePoints.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>
</article>`;

const documentStyles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #e9e4da;
    color: #1c1f1c;
    font-family: "Noto Serif SC", "Songti SC", "SimSun", serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .book { width: 820px; max-width: 100%; margin: 26px auto; padding: 42px 46px; background: #fbf8f1; box-shadow: 0 18px 50px rgba(28,31,28,.16); }
  .cover { min-height: 930px; padding: 46px 42px; border: 1px solid #d8cfbd; background: radial-gradient(circle at 85% 0%, rgba(44,75,67,.08), transparent 34%), #f7f1e5; position: relative; display: flex; flex-direction: column; }
  .cover-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d8cfbd; padding-bottom: 15px; color: #6d736c; font-size: 10px; letter-spacing: .16em; }
  .brand { color: #2c4b43; font-size: 18px; font-weight: 700; letter-spacing: .22em; }
  .cover-main { margin-top: 90px; }
  .eyebrow { margin: 0; color: #a8463a; font-size: 11px; font-weight: 700; letter-spacing: .24em; }
  .cover h1 { margin: 16px 0 0; font-size: 52px; line-height: 1.2; letter-spacing: .05em; font-weight: 700; color: #1c1f1c; }
  .cover h1 em { color: #2c4b43; font-style: normal; }
  .cover-sub { margin: 18px 0 0; color: #4e544d; font-size: 13px; line-height: 1.8; }
  .cover-stats { display: flex; gap: 10px; margin-top: 34px; flex-wrap: wrap; }
  .stat { min-width: 92px; padding: 10px 13px; border: 1px solid #d8cfbd; background: rgba(251,248,241,.66); }
  .stat b { display: block; color: #2c4b43; font-size: 24px; line-height: 1.1; }
  .stat span { display: block; margin-top: 4px; color: #6d736c; font-size: 9px; letter-spacing: .08em; }
  .cover-foot { margin-top: auto; padding-top: 22px; border-top: 1px solid #d8cfbd; display: flex; justify-content: space-between; color: #777b72; font-size: 9px; letter-spacing: .08em; }
  .seal { position: absolute; right: 42px; bottom: 72px; width: 58px; height: 58px; display: grid; place-items: center; background: #a8463a; color: #f5f0e6; font-size: 22px; transform: rotate(-5deg); box-shadow: 0 6px 13px rgba(28,31,28,.14); }
  .seal::after { content: ""; position: absolute; inset: 5px; border: 1px solid rgba(245,240,230,.5); }
  .section { margin-top: 38px; }
  .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 9px; border-bottom: 2px solid #2c4b43; }
  .section-head h2 { margin: 0; color: #1c1f1c; font-size: 22px; letter-spacing: .06em; }
  .section-head span { color: #6d736c; font-size: 10px; letter-spacing: .08em; }
  .section-note { margin: 9px 0 18px; color: #777b72; font-size: 10px; line-height: 1.7; }
  .wrong-card, .note-card { break-inside: avoid; page-break-inside: avoid; margin: 0 0 16px; padding: 17px 18px; border: 1px solid #d8cfbd; background: #fffdf8; }
  .note-card { border-left: 3px solid #86662f; }
  .card-top { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: #777b72; font-size: 9px; letter-spacing: .04em; }
  .index { color: #a8463a; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
  .type, .status { padding: 2px 6px; border-radius: 3px; background: #f0eadf; color: #4e544d; }
  .status.is-active { background: #f4e5e0; color: #a8463a; }
  .status.is-mastered { background: #e5eee8; color: #2c4b43; }
  .status.is-ignored { background: #efeee9; color: #6d736c; }
  .path { margin-left: auto; max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stem { margin: 12px 0 12px; font-size: 15px; line-height: 1.75; font-weight: 600; }
  .options { display: grid; gap: 5px; margin: 0 0 13px; padding: 0; list-style: none; }
  .option { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; color: #3e453f; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11px; line-height: 1.55; }
  .option b { flex: 0 0 auto; color: #6d736c; font-family: Georgia, serif; font-size: 11px; }
  .option.is-correct { background: #e8f0ea; color: #2c4b43; }
  .option.is-correct b { color: #2c4b43; }
  .option.is-wrong-pick { background: #f7e9e4; color: #8e4a55; text-decoration: line-through; text-decoration-color: rgba(168,70,58,.45); }
  .answer-row { display: flex; gap: 12px; align-items: baseline; padding: 7px 0; border-top: 1px dashed #e1d8c8; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11px; line-height: 1.6; }
  .answer-row span { flex: 0 0 68px; color: #777b72; }
  .answer-row strong { color: #2c4b43; font-weight: 600; }
  .answer-row.muted strong { color: #4e544d; font-weight: 400; }
  .explain { margin-top: 11px; padding: 9px 10px; background: #f7f2e7; border-left: 2px solid #d8cfbd; }
  .explain span { color: #86662f; font-size: 9px; letter-spacing: .08em; }
  .explain p { margin: 5px 0 0; color: #4e544d; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 10.5px; line-height: 1.75; }
  .wrong-meta { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 10px; color: #8a8e84; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 9px; }
  .knowledge { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
  .knowledge span { padding: 2px 6px; border: 1px solid #e1d8c8; color: #6d736c; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 9px; }
  .note-block { margin-top: 12px; padding: 10px 12px; border-left: 3px solid #86662f; background: #f6f0e3; }
  .note-label { color: #86662f; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .08em; }
  .note-label span { margin-left: 8px; color: #8a8e84; font-weight: 400; }
  .note-content { margin-top: 6px; color: #3e453f; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11px; line-height: 1.75; white-space: pre-wrap; }
  .empty { padding: 28px 18px; border: 1px dashed #d8cfbd; color: #777b72; text-align: center; font-size: 12px; }
  .note-time { margin-left: auto; }
  .doc-end { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e1d8c8; color: #9a9e94; font-size: 9px; text-align: center; letter-spacing: .08em; }
  @media screen and (max-width: 760px) {
    .book { width: 100%; margin: 0; padding: 22px 18px; }
    .cover { min-height: 0; padding: 24px 20px; }
    .cover-main { margin-top: 32px; }
    .cover h1 { font-size: 36px; }
    .cover-sub { font-size: 11px; }
    .cover-stats { margin-top: 22px; }
    .stat { min-width: 78px; padding: 8px 10px; }
    .stat b { font-size: 20px; }
    .section { margin-top: 26px; }
    .wrong-card, .note-card { padding: 13px 12px; }
    .seal { display: none; }
    .cover-foot { font-size: 8px; }
  }
  @page { size: A4; margin: 14mm 13mm 15mm; }
  @media print {
    body { background: #fff; }
    .book { width: auto; max-width: none; margin: 0; padding: 0; background: #fff; box-shadow: none; }
    .cover { min-height: 0; height: 260mm; page-break-after: always; break-after: page; border: 0; }
    .section { margin-top: 0; }
    .section-head { margin-top: 7mm; }
    .wrong-card, .note-card { margin-bottom: 5mm; }
    .doc-end { display: none; }
  }
`;

export const buildWrongBookHtml = (
  state: AppState,
  catalog: Catalog,
  bankId: string | undefined,
  options: WrongBookOptions
): string => {
  const bank = bankId ? catalog.bankById.get(bankId) : undefined;
  const scope = new Set(
    bankId && bank ? catalog.subtreeIds(bankId) : catalog.visibleBanks.map((item) => item.id)
  );
  const bankPathOf = (question: Question) =>
    catalog.bankPath(question.bankId).map((item) => item.name).join(" / ");
  const questionInScope = (question: Question) =>
    scope.has(question.bankId) || scope.has(question.rootBankId);
  const questions = catalog.questions.filter(questionInScope);
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const notes = options.includeNotes
    ? state.notes.filter((note) => questionById.has(note.questionId))
    : [];
  const noteByQuestion = new Map(notes.map((note) => [note.questionId, note]));

  const allowed = new Set<WrongQuestion["status"]>(["active"]);
  if (options.includeMastered) allowed.add("mastered");
  if (options.includeIgnored) allowed.add("ignored");
  const wrongs = state.wrongs
    .filter((wrong) => allowed.has(wrong.status))
    .map((wrong) => ({ wrong, question: questionById.get(wrong.questionId) }))
    .filter((entry): entry is { wrong: WrongQuestion; question: Question } => Boolean(entry.question))
    .sort((a, b) => {
      const path = bankPathOf(a.question).localeCompare(bankPathOf(b.question), "zh-CN");
      return path || a.question.sortIndex - b.question.sortIndex || a.question.stem.localeCompare(b.question.stem, "zh-CN");
    });

  const wrongQuestionIds = new Set(wrongs.map((entry) => entry.question.id));
  const extraNotes = notes
    .filter((note) => !wrongQuestionIds.has(note.questionId))
    .map((note) => ({ note, question: questionById.get(note.questionId) }))
    .filter((entry): entry is { note: UserNote; question: Question } => Boolean(entry.question))
    .sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));

  const title = bank ? catalog.bankPath(bank.id).map((item) => item.name).join(" / ") : "全部题库";
  const mainName = bank?.name ?? "全部题库";
  const generated = formatDate(new Date());
  const wrongHtml = wrongs
    .map(({ wrong, question }, index) =>
      renderWrongCard(
        index + 1,
        question,
        wrong,
        latestRecordFor(state.records, question.id),
        options.includeNotes ? noteByQuestion.get(question.id) : undefined,
        bankPathOf(question)
      )
    )
    .join("");
  const extraNoteHtml = extraNotes
    .map(({ note, question }) => renderExtraNote(note, question, bankPathOf(question)))
    .join("");

  const emptyWrong = `<div class="empty">本库暂无符合条件的错题。</div>`;
  const emptyNotes = `<div class="empty">本库没有额外的非错题笔记。</div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(mainName)} · 错题本</title>
  <style>${documentStyles}</style>
</head>
<body>
  <main class="book">
    <section class="cover">
      <div class="cover-top"><span class="brand">闱墨</span><span>错题本 · 复盘册</span></div>
      <div class="cover-main">
        <p class="eyebrow">本地题库 · 个人复盘</p>
        <h1>${escapeHtml(mainName)}<br /><em>错题本</em></h1>
        <p class="cover-sub">${escapeHtml(title)}<br />把错处收拢，按自己的节奏重做一遍。</p>
        <div class="cover-stats">
          <div class="stat"><b>${wrongs.length}</b><span>道错题</span></div>
          <div class="stat"><b>${notes.length}</b><span>条笔记</span></div>
          <div class="stat"><b>${questions.length}</b><span>道题在库</span></div>
        </div>
      </div>
      <div class="cover-foot"><span>${escapeHtml(generated)}</span><span>github.com/chuankkk/weimo</span></div>
      <div class="seal">墨</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>错题本</h2><span>${wrongs.length} 道 · 按题库顺序</span></div>
      <p class="section-note">正确答案用黛青标出；最近一次答错的选项用朱砂划线。笔记会显示在对应题目下方。</p>
      ${wrongHtml || emptyWrong}
    </section>

    ${
      options.includeNotes
        ? `<section class="section">
            <div class="section-head"><h2>补充笔记</h2><span>${extraNotes.length} 条 · 非错题</span></div>
            <p class="section-note">已经出现在上方错题卡片里的笔记不重复收录；这里是本库其他题目的笔记。</p>
            ${extraNoteHtml || emptyNotes}
          </section>`
        : ""
    }

    <div class="doc-end">闱墨 · 题库属于你，数据留在本机 · ${escapeHtml(generated)}</div>
  </main>
</body>
</html>`;
};

export const wrongBookFileName = (bankName: string | undefined) => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `闱墨-错题本-${safeFileName(bankName ?? "全部题库")}-${stamp}.html`;
};
