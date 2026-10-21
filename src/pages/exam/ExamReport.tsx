import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Flag,
  ListChecks,
  Minus,
  RotateCcw,
  XCircle
} from "lucide-react";
import type { ExamSession, PracticeSessionState } from "../../types";
import { typeLabel } from "../../lib/constants";
import { evaluateExam } from "../../lib/exam";
import { formatAnswer, formatUserAnswer } from "../../lib/text";
import { formatDate, formatDuration } from "../../lib/date";
import { createPracticeSession } from "../../lib/session";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { Button, DifficultyDots, EmptyState, IconButton, ProgressBar, ProgressRing, SectionHead, SectionNav, Segmented, StatCard, TypeBadge } from "../../components/ui";
import { cn } from "../../lib/text";

export function ExamReport({ session }: { session: ExamSession }) {
  const { state, catalog, update, toast } = useApp();
  const template = state.exams.find((item) => item.id === session.templateId);
  const result = useMemo(() => evaluateExam(session, catalog, template), [session, catalog, template]);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const accuracy = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const duration = session.submittedAt
    ? new Date(session.submittedAt).getTime() - new Date(session.startedAt).getTime()
    : 0;
  const wrongRows = result.rows.filter((row) => !row.isCorrect);
  const rows = filter === "wrong" ? wrongRows : result.rows;

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const retryWrong = () => {
    if (!wrongRows.length) {
      toast("本场没有错题，成绩很棒", { tone: "success" });
      return;
    }
    const next: PracticeSessionState = createPracticeSession(
      wrongRows.slice(0, 50).map((row) => row.question.id),
      "wrong"
    );
    update((current) => ({ ...current, practiceSession: next }));
    navigate("practice", { run: "1" });
  };

  return (
    <section className="page report-page">
      <div className="report-head">
        <IconButton label="返回考试" onClick={() => navigate("exam")}>
          <ArrowLeft />
        </IconButton>
        <div>
          <p className="eyebrow">考试报告 · {session.submittedAt ? formatDate(session.submittedAt) : ""}</p>
          <h1>{session.name}</h1>
          <p>
            {session.status === "timeout" ? "时间到，已自动交卷" : "已交卷"} · 用时 {formatDuration(duration)}
          </p>
        </div>
        <span className={cn("report-status", session.status === "timeout" && "is-timeout")}>
          {session.status === "timeout" ? <AlertTriangle aria-hidden="true" /> : <Award aria-hidden="true" />}
          {session.status === "timeout" ? "超时交卷" : "完成"}
        </span>
      </div>

      <SectionNav
        items={[
          { id: "report-score", label: "成绩" },
          { id: "report-types", label: "题型表现" },
          { id: "report-review", label: "逐题回顾" }
        ]}
      />

      <div className="report-hero" id="report-score">
        <ProgressRing value={accuracy / 100} size={144} stroke={10}>
          <strong>{accuracy}%</strong>
          <small>正确率</small>
        </ProgressRing>
        <div className="report-hero-copy">
          <p className="eyebrow">本场得分</p>
          <h2>
            {result.score}
            <small>/ {result.maxScore} 分</small>
          </h2>
          <p>
            答对 {result.correct} 题 · 答错 {result.wrong} 题 · 未作答 {result.unanswered} 题
          </p>
          <div className="report-actions">
            <Button icon={<RotateCcw />} onClick={retryWrong} disabled={!wrongRows.length}>
              重练错题
            </Button>
            <Button variant="ghost" icon={<ClipboardCheck />} onClick={() => navigate("exam")}>
              返回考试
            </Button>
          </div>
        </div>
      </div>

      <div className="stat-strip three">
        <StatCard label="正确" value={result.correct} unit="题" tone="jade" icon={<CheckCircle2 />} />
        <StatCard label="错误" value={result.wrong} unit="题" tone="rose" icon={<XCircle />} />
        <StatCard label="未作答 / 标记" value={result.unanswered} unit="题" hint={`标记 ${session.marked.length} 题`} />
      </div>

      <div className="home-split">
        <section className="card report-types" id="report-types">
          <div className="card-head">
            <div>
              <h2>题型表现</h2>
              <p>按题型统计得分与正确率</p>
            </div>
          </div>
          <ul>
            {result.byType.map((type) => {
              const rate = type.total ? type.correct / type.total : 0;
              return (
                <li key={type.type}>
                  <div className="report-type-head">
                    <TypeBadge type={type.type} />
                    <span>
                      {type.correct} / {type.total} 题
                    </span>
                    <b>{type.total ? Math.round(rate * 100) : 0}%</b>
                  </div>
                  <ProgressBar value={rate} tone={rate >= 0.6 ? "jade" : "rose"} size="sm" label={`${typeLabel[type.type]}正确率`} />
                  <small className="report-type-score">
                    {type.score} / {type.maxScore} 分
                  </small>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card report-insight">
          <div className="card-head">
            <div>
              <h2>复盘提示</h2>
              <p>根据本场表现自动生成</p>
            </div>
          </div>
          <ul className="insight-list">
            <li>
              <span className="insight-icon">
                <Award aria-hidden="true" />
              </span>
              <div>
                <strong>{accuracy >= 80 ? "整体掌握良好" : accuracy >= 60 ? "基础已经建立" : "需要系统回看"}</strong>
                <p>
                  {accuracy >= 80
                    ? "把错题重刷一次，并把易错知识点加入笔记，就能进一步巩固。"
                    : accuracy >= 60
                      ? "优先处理标记与未作答题目，再按题型回看薄弱部分。"
                      : "建议先回到题库按章节顺序练习，再进行限时模考。"}
                </p>
              </div>
            </li>
            {wrongRows.length ? (
              <li>
                <span className="insight-icon">
                  <Flag aria-hidden="true" />
                </span>
                <div>
                  <strong>本场 {wrongRows.length} 题需要回看</strong>
                  <p>这些题目已进入错题本，可点击“重练错题”立即开始。</p>
                </div>
              </li>
            ) : null}
            <li>
              <span className="insight-icon">
                <Clock aria-hidden="true" />
              </span>
              <div>
                <strong>时间分配</strong>
                <p>
                  本场用时 {formatDuration(duration)}，平均每题{" "}
                  {result.total ? formatDuration(duration / result.total) : "—"}。
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <SectionHead
        id="report-review"
        icon={<ListChecks />}
        title="逐题回顾"
        hint={`${result.rows.length} 题 · 错题 ${wrongRows.length} 题`}
        action={
          <Segmented
            ariaLabel="回顾筛选"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "全部", badge: result.rows.length },
              { value: "wrong", label: "错题", badge: wrongRows.length }
            ]}
          />
        }
      />

      {rows.length ? (
        <div className="review-list card">
          {rows.map((row) => {
            const isOpen = expanded.has(row.question.id);
            const answered = row.answer.some(Boolean);
            const order = result.rows.findIndex((item) => item.question.id === row.question.id) + 1;
            const tone = row.isCorrect ? "is-correct" : answered ? "is-wrong" : "is-unanswered";
            return (
              <article className={cn("review-row report-row", tone)} key={row.question.id}>
                <button type="button" className="report-row-main" onClick={() => toggle(row.question.id)} aria-expanded={isOpen}>
                  <span className={cn("review-index", tone)}>{String(order).padStart(2, "0")}</span>
                  <span className="review-mark" aria-hidden="true">
                    {row.isCorrect ? <CheckCircle2 /> : answered ? <XCircle /> : <Minus />}
                  </span>
                  <span className="review-copy">
                    <p>{row.question.stem}</p>
                    <span>
                      <TypeBadge type={row.question.type} />
                      <DifficultyDots value={row.question.difficulty} />
                      {answered ? `你的答案：${formatUserAnswer(row.question, row.answer)}` : "未作答"}
                    </span>
                  </span>
                  <span className="report-row-score">
                    {row.score} <small>/ {row.maxScore}</small>
                  </span>
                  {isOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>
                {isOpen ? (
                  <div className="report-row-detail">
                    <div className="report-row-answer">
                      <span>
                        <b>正确答案</b>
                        {formatAnswer(row.question)}
                      </span>
                      <span>
                        <b>你的答案</b>
                        {answered ? formatUserAnswer(row.question, row.answer) : "未作答"}
                      </span>
                    </div>
                    {row.question.options.length ? (
                      <ul className="report-options">
                        {row.question.options.map((option) => (
                          <li key={option.key} className={row.question.answer.includes(option.key) ? "is-correct" : ""}>
                            <b>{option.key}</b>
                            {option.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p>
                      <b>解析：</b>
                      {row.question.explanation || "暂无解析"}
                    </p>
                    {row.question.knowledgePoints.length ? (
                      <p className="muted-line">知识点：{row.question.knowledgePoints.join(" · ")}</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<CheckCircle2 />} title="全部答对" description="本场没有错题，保持这个节奏。" />
      )}
    </section>
  );
}
