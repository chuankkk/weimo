import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, Clock, Flag, ListChecks, XCircle } from "lucide-react";
import type { ExamSession } from "../../types";
import { typeLabel } from "../../lib/constants";
import { finalizeExam } from "../../lib/exam";
import { formatClock } from "../../lib/date";
import { isTypingTarget, useCountdown, useKeydown } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { updateExamSession } from "../../store/actions";
import { QuestionCard } from "../../components/question";
import { Modal } from "../../components/overlays";
import { Button, EmptyState, IconButton, InlineNotice, ProgressBar } from "../../components/ui";
import { cn } from "../../lib/text";

export function ExamRunner({ session }: { session: ExamSession }) {
  const { catalog, update, toast, confirm } = useApp();
  const [index, setIndex] = useState(() =>
    Math.min(session.questionIds.length - 1, Math.max(0, session.currentIndex ?? 0))
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const question = catalog.questionById.get(session.questionIds[index]);
  const target = useMemo(
    () => new Date(session.startedAt).getTime() + session.durationMinutes * 60_000,
    [session.startedAt, session.durationMinutes]
  );
  const remaining = useCountdown(target, () => {
    update((current) => finalizeExam(current, session.id, catalog, "timeout"));
    toast("考试时间到，已自动交卷", { tone: "error", duration: 5000 });
  });
  const answeredIds = useMemo(
    () => session.questionIds.filter((id) => session.answers[id]?.some((item) => item.trim())),
    [session.answers, session.questionIds]
  );
  const progress = session.questionIds.length ? answeredIds.length / session.questionIds.length : 0;
  const urgent = remaining <= 5 * 60_000;
  const answer = question ? session.answers[question.id] ?? [] : [];
  const marked = question ? session.marked.includes(question.id) : false;

  const goTo = (next: number) => {
    const clamped = Math.min(session.questionIds.length - 1, Math.max(0, next));
    setIndex(clamped);
    update((current) => updateExamSession(current, session.id, (item) => ({ ...item, currentIndex: clamped })));
  };

  const setAnswer = (next: string[]) => {
    if (!question) return;
    update((current) =>
      updateExamSession(current, session.id, (item) => ({
        ...item,
        answers: { ...item.answers, [question.id]: next }
      }))
    );
  };

  const toggleMark = () => {
    if (!question) return;
    update((current) =>
      updateExamSession(current, session.id, (item) => ({
        ...item,
        marked: item.marked.includes(question.id)
          ? item.marked.filter((id) => id !== question.id)
          : [...item.marked, question.id]
      }))
    );
  };

  const submit = async () => {
    const unanswered = session.questionIds.length - answeredIds.length;
    const accepted = await confirm({
      title: "确认交卷？",
      description: unanswered
        ? `还有 ${unanswered} 题未作答。交卷后会按未作答计分，且不能修改答案。`
        : "所有题目已作答。交卷后不能修改答案。",
      confirmText: "交卷",
      cancelText: "继续作答"
    });
    if (!accepted) return;
    update((current) => finalizeExam(current, session.id, catalog, "submitted"));
    toast("已交卷，正在生成报告", { tone: "success" });
  };

  const exit = async () => {
    const accepted = await confirm({
      title: "暂时退出考试？",
      description: "已作答内容会保存，计时继续。可在考试页点击“继续考试”。",
      confirmText: "退出考试",
      cancelText: "留在考试"
    });
    if (accepted) navigate("exam");
  };

  useKeydown((event) => {
    if (isTypingTarget(event.target)) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, a, input")) return;
    if (question && (question.type === "single" || question.type === "multiple")) {
      const optionIndex = Number(event.key) - 1;
      if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < question.options.length) {
        event.preventDefault();
        const key = question.options[optionIndex].key;
        if (question.type === "multiple") {
          setAnswer(answer.includes(key) ? answer.filter((item) => item !== key) : [...answer, key]);
        } else {
          setAnswer([key]);
        }
      }
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    }
    if (event.key.toLowerCase() === "m") toggleMark();
  });

  if (!question) {
    return (
      <section className="page runner-page">
        <EmptyState
          icon={<XCircle />}
          title="试卷题目已不存在"
          description="部分题目可能已被删除，请返回考试页重新组卷。"
          action={<Button onClick={() => navigate("exam")}>返回考试</Button>}
        />
      </section>
    );
  }

  return (
    <section className="page runner-page exam-runner">
      <header className="runner-bar">
        <IconButton label="暂时退出考试" onClick={() => void exit()}>
          <ArrowLeft />
        </IconButton>
        <div className="runner-title">
          <strong>{session.name}</strong>
          <small>
            第 {index + 1} / {session.questionIds.length} 题 · 已答 {answeredIds.length} 题
          </small>
        </div>
        <span className={cn("exam-timer", urgent && "is-urgent")} role="timer" aria-label="考试剩余时间">
          <Clock aria-hidden="true" />
          <span className="timer-caption">剩余</span>
          {formatClock(remaining)}
        </span>
      </header>

      <div className="runner-progress">
        <ProgressBar value={progress} tone={urgent ? "rose" : "jade"} label="答题进度" />
        <div className="runner-progress-meta">
          <span>{Math.round(progress * 100)}%</span>
          <button type="button" onClick={() => setSheetOpen(true)}>
            答题卡 · {answeredIds.length}/{session.questionIds.length}
          </button>
        </div>
      </div>

      <QuestionCard
        question={question}
        answer={answer}
        onAnswer={setAnswer}
        bankLabel={catalog.bankName(question.bankId)}
      />

      <div className="exam-tools">
        <Button variant={marked ? "secondary" : "ghost"} size="sm" icon={<Flag />} onClick={toggleMark}>
          {marked ? "已标记待回看" : "标记待回看"}
        </Button>
        <span>答案自动保存 · 切换题目不会丢失</span>
      </div>

      <div className="runner-actions exam-runner-actions">
        <Button variant="ghost" icon={<ArrowLeft />} onClick={() => goTo(index - 1)} disabled={index === 0}>
          上一题
        </Button>
        <Button variant="secondary" icon={<ListChecks />} onClick={() => setSheetOpen(true)}>
          答题卡
        </Button>
        <Button icon={<ArrowRight />} onClick={() => goTo(index + 1)} disabled={index >= session.questionIds.length - 1}>
          下一题
        </Button>
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="答题卡"
        description={`已答 ${answeredIds.length} 题 · 未答 ${session.questionIds.length - answeredIds.length} 题 · 标记 ${session.marked.length} 题`}
        size="lg"
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              继续作答
            </Button>
            <Button variant="danger" icon={<ClipboardCheck />} onClick={() => void submit()}>
              交卷
            </Button>
          </>
        }
      >
        <div className="sheet-legend">
          <span>
            <i className="is-answered" /> 已答
          </span>
          <span>
            <i className="is-empty" /> 未答
          </span>
          <span>
            <i className="is-marked" /> 标记
          </span>
          <span>
            <i className="is-current" /> 当前
          </span>
        </div>
        <div className="sheet-grid">
          {session.questionIds.map((id, itemIndex) => {
            const item = catalog.questionById.get(id);
            const answered = session.answers[id]?.some((value) => value.trim());
            const isMarked = session.marked.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={cn(
                  "sheet-cell",
                  answered && "is-answered",
                  isMarked && "is-marked",
                  itemIndex === index && "is-current"
                )}
                onClick={() => {
                  goTo(itemIndex);
                  setSheetOpen(false);
                }}
                aria-label={`第 ${itemIndex + 1} 题${answered ? "，已答" : "，未答"}${isMarked ? "，已标记" : ""}`}
              >
                {itemIndex + 1}
                {item ? <small>{typeLabel[item.type]}</small> : null}
              </button>
            );
          })}
        </div>
        <InlineNotice tone="warn">
          交卷后本场考试将立即计分，未作答题目按错误处理并进入错题本。
        </InlineNotice>
      </Modal>
    </section>
  );
}
