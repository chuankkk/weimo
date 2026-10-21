import { useMemo } from "react";
import { ArrowLeft, Check, CheckCircle2, ListChecks, RotateCcw, Sparkles, XCircle } from "lucide-react";
import type { PracticeMode, PracticeSessionState } from "../../types";
import { modeLabel } from "../../lib/constants";
import { formatAnswer } from "../../lib/text";
import { formatDuration } from "../../lib/date";
import { sessionSummary } from "../../lib/stats";
import { createPracticeSession } from "../../lib/session";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { clearPractice } from "../../store/actions";
import { Button, EmptyState, ProgressRing, SectionHead, TypeBadge } from "../../components/ui";
import { cn } from "../../lib/text";

export function PracticeSummary({ session }: { session: PracticeSessionState }) {
  const { state, catalog, update, toast, confirm } = useApp();
  const records = useMemo(
    () => state.records.filter((record) => record.sessionId === session.id),
    [state.records, session.id]
  );
  const summary = sessionSummary(records);
  const duration = session.completedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 0;
  const wrongRecords = records.filter((record) => !record.isCorrect);

  const exitToSetup = (mode?: PracticeMode) => {
    update(clearPractice);
    navigate("practice", mode ? { mode } : undefined);
  };

  const retryWrong = () => {
    if (!wrongRecords.length) {
      toast("本次没有错题，做得不错", { tone: "success" });
      return;
    }
    update((current) => ({
      ...current,
      practiceSession: createPracticeSession(
        wrongRecords.slice(0, 50).map((record) => record.questionId),
        "wrong"
      )
    }));
    navigate("practice", { run: "1" });
  };

  const backHome = async () => {
    const accepted = await confirm({
      title: "返回首页？",
      description: "本组练习记录已保存，可在首页或错题本中回看。",
      confirmText: "返回首页"
    });
    if (!accepted) return;
    update(clearPractice);
    navigate("home");
  };

  return (
    <section className="page summary-page">
      <div className="summary-hero">
        <div className="summary-ring">
          <ProgressRing value={summary.accuracy / 100} size={132} stroke={9}>
            <strong>{summary.accuracy}%</strong>
            <small>正确率</small>
          </ProgressRing>
        </div>
        <div className="summary-copy">
          <p className="eyebrow">本组完成</p>
          <h1>{summary.accuracy >= 80 ? "墨色正浓。" : summary.accuracy >= 50 ? "渐入佳境。" : "再来一遍。"}</h1>
          <p>
            {modeLabel[session.mode]} · 共 {summary.total} 题 · 用时 {formatDuration(duration)}
          </p>
          <div className="summary-stats">
            <span className="is-correct">
              <CheckCircle2 aria-hidden="true" /> {summary.correct} 题正确
            </span>
            <span className="is-wrong">
              <XCircle aria-hidden="true" /> {summary.wrong} 题待巩固
            </span>
          </div>
        </div>
      </div>

      <div className="summary-actions">
        <Button variant="ghost" icon={<ArrowLeft />} onClick={() => exitToSetup(session.mode)}>
          再练一组
        </Button>
        {wrongRecords.length ? (
          <Button variant="secondary" icon={<RotateCcw />} onClick={retryWrong}>
            立即重做错题
          </Button>
        ) : null}
        <Button icon={<Sparkles />} onClick={() => void backHome()}>
          返回首页
        </Button>
      </div>

      {records.length ? (
        <>
          <SectionHead icon={<ListChecks />} title="本组回顾" hint="按作答顺序回顾题目与结果" />
          <div className="review-list card">
            {records.map((record, index) => {
              const question = catalog.questionById.get(record.questionId);
              if (!question) return null;
              return (
                <div className={cn("review-row", record.isCorrect ? "is-correct" : "is-wrong")} key={record.id}>
                  <span className="review-index">{index + 1}</span>
                  <span className="review-mark" aria-hidden="true">
                    {record.isCorrect ? <Check /> : <XCircle />}
                  </span>
                  <div className="review-copy">
                    <p>{question.stem}</p>
                    <span>
                      <TypeBadge type={question.type} />
                      {question.knowledgePoints.slice(0, 2).join(" · ")}
                    </span>
                  </div>
                  <span className="review-answer">
                    {record.isCorrect ? "正确" : `答案：${formatAnswer(question)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState icon={<ListChecks />} title="暂无作答记录" description="本组还没有提交过答案。" />
      )}
    </section>
  );
}
