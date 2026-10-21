import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, MoveHorizontal, XCircle } from "lucide-react";
import type { PracticeSessionState } from "../../types";
import { modeLabel, typeLabel } from "../../lib/constants";
import { formatDuration, nowIso } from "../../lib/date";
import { evaluateQuestion } from "../../lib/quiz";
import { isTypingTarget, useElapsed, useKeydown } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { applyPracticeAnswer } from "../../store/actions";
import { QuestionCard, AnswerPanel, NoteEditor } from "../../components/question";
import { Button, EmptyState, IconButton, Kbd } from "../../components/ui";
import { cn, uid } from "../../lib/text";
import { RunnerRail } from "./RunnerRail";

export function PracticeRunner({ session }: { session: PracticeSessionState }) {
  const { state, catalog, update, toast, confirm } = useApp();
  const question = catalog.questionById.get(session.questionIds[session.currentIndex]);
  const [autoNext, setAutoNext] = useState(false);
  const autoTimer = useRef<number | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const answer = question ? session.answers[question.id] ?? [] : [];
  const submitted = question ? Boolean(session.submitted[question.id]) : false;
  const evaluation = question && submitted ? evaluateQuestion(question, answer) : null;
  const answeredCount = Object.keys(session.submitted).length;
  const total = session.questionIds.length;
  const isLast = session.currentIndex >= total - 1;
  const progress = total ? (session.currentIndex + (submitted ? 1 : 0)) / total : 0;

  const clearAutoTimer = () => {
    if (autoTimer.current) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    setAutoNext(false);
  };

  useEffect(
    () => () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    },
    []
  );
  useEffect(() => {
    clearAutoTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 切换题目时重置自动跳转与滚动位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.currentIndex]);

  const updateSession = (updater: (current: PracticeSessionState) => PracticeSessionState) => {
    update((current) =>
      current.practiceSession ? { ...current, practiceSession: updater(current.practiceSession) } : current
    );
  };

  const goNext = () => {
    clearAutoTimer();
    if (isLast) {
      updateSession((current) => ({ ...current, completedAt: nowIso() }));
      return;
    }
    updateSession((current) => ({
      ...current,
      currentIndex: current.currentIndex + 1,
      questionStartedAt: nowIso()
    }));
  };

  const goPrev = () => {
    clearAutoTimer();
    updateSession((current) => ({
      ...current,
      currentIndex: Math.max(0, current.currentIndex - 1)
    }));
  };

  const goTo = (next: number) => {
    clearAutoTimer();
    updateSession((current) => ({
      ...current,
      currentIndex: Math.min(total - 1, Math.max(0, next))
    }));
  };

  const startSwipe = (event: ReactTouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const endSwipe = (event: ReactTouchEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    // 排除纵向滚动和误触；横向滑动超过 56px 才切题。
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    if (deltaX < 0) {
      if (!submitted) {
        toast("先提交答案，再滑动切到下一题", { tone: "info" });
        return;
      }
      goNext();
      return;
    }
    if (session.currentIndex > 0) goPrev();
  };

  const submit = () => {
    if (!question) return;
    if (!answer.some((item) => item.trim())) {
      toast("先作答再提交", { tone: "error" });
      return;
    }
    const result = evaluateQuestion(question, answer);
    const answeredAt = nowIso();
    const startedAt = session.questionStartedAt ?? session.startedAt;
    const timeSpentMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
    const recordId = uid("record");
    update((current) => {
      if (!current.practiceSession) return current;
      const next = applyPracticeAnswer(
        current,
        question,
        current.practiceSession,
        answer,
        result.isCorrect,
        timeSpentMs,
        recordId,
        answeredAt
      );
      if (!next.practiceSession) return next;
      return {
        ...next,
        practiceSession: {
          ...next.practiceSession,
          submitted: { ...next.practiceSession.submitted, [question.id]: true }
        }
      };
    });

    if (state.settings.autoNext && result.isCorrect && !isLast) {
      setAutoNext(true);
      autoTimer.current = window.setTimeout(() => {
        autoTimer.current = null;
        setAutoNext(false);
        goNext();
      }, 1400);
    }
  };

  const requestExit = async () => {
    const accepted = await confirm({
      title: "退出本次练习？",
      description: "进度会自动保留，下次可从这里继续。",
      confirmText: "退出练习",
      cancelText: "继续作答"
    });
    if (accepted) {
      clearAutoTimer();
      navigate("practice");
    }
  };

  useKeydown((event) => {
    if (isTypingTarget(event.target)) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (submitted) goNext();
      else submit();
      return;
    }
    if (submitted || !question) return;
    if (question.type === "single" || question.type === "multiple") {
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < question.options.length) {
        event.preventDefault();
        const key = question.options[index].key;
        if (question.type === "multiple") {
          const current = answer.includes(key) ? answer.filter((item) => item !== key) : [...answer, key];
          updateSession((sessionState) => ({
            ...sessionState,
            answers: { ...sessionState.answers, [question.id]: current }
          }));
        } else {
          updateSession((sessionState) => ({
            ...sessionState,
            answers: { ...sessionState.answers, [question.id]: [key] }
          }));
        }
      }
    }
    if (question.type === "judge" && (event.key === "1" || event.key === "2")) {
      event.preventDefault();
      updateSession((sessionState) => ({
        ...sessionState,
        answers: { ...sessionState.answers, [question.id]: [event.key === "1" ? "true" : "false"] }
      }));
    }
  });

  if (!question) {
    return (
      <section className="page runner-page">
        <EmptyState
          icon={<XCircle />}
          title="题目已不存在"
          description="这组练习中的题目可能已被删除，请重新选择练习范围。"
          action={<Button onClick={() => navigate("practice")}>返回练习</Button>}
        />
      </section>
    );
  }

  return (
    <section
      className="page runner-page"
      onTouchStart={startSwipe}
      onTouchEnd={endSwipe}
      onTouchCancel={() => {
        swipeStart.current = null;
      }}
    >
      <header className="runner-bar">
        <IconButton label="退出练习" onClick={() => void requestExit()}>
          <ArrowLeft />
        </IconButton>
        <div className="runner-title">
          <strong>{modeLabel[session.mode]}</strong>
          <small>
            第 {session.currentIndex + 1} / {total} 题 · 已答 {answeredCount} 题
          </small>
        </div>
        <ElapsedTimer startedAt={session.startedAt} />
      </header>

      <div className="runner-progress">
        <RunnerRail session={session} current={session.currentIndex} onJump={goTo} />
        <div className="runner-progress-meta">
          <span>{Math.round(progress * 100)}%</span>
          <span>{typeLabel[question.type]}</span>
        </div>
      </div>
      <p className="swipe-hint">
        <MoveHorizontal aria-hidden="true" /> 提交后可左右滑动切题
      </p>

      <QuestionCard
        question={question}
        answer={answer}
        submitted={submitted}
        evaluation={evaluation}
        onAnswer={(next) =>
          updateSession((current) => ({
            ...current,
            answers: { ...current.answers, [question.id]: next }
          }))
        }
      />

      {submitted && evaluation ? (
        <>
          <AnswerPanel question={question} evaluation={evaluation} userAnswer={answer} />
          <NoteEditor questionId={question.id} />
        </>
      ) : null}

      <div className={cn("runner-actions", submitted && "is-submitted")}>
        <Button variant="ghost" icon={<ArrowLeft />} onClick={goPrev} disabled={session.currentIndex === 0}>
          上一题
        </Button>
        {!submitted ? (
          <Button
            className="runner-primary"
            icon={<CheckCircle2 />}
            onClick={submit}
            disabled={!answer.some((item) => item.trim())}
          >
            提交答案
          </Button>
        ) : (
          <Button className={cn("runner-primary", autoNext && "is-counting")} icon={isLast ? <CheckCircle2 /> : <ArrowRight />} onClick={goNext}>
            {isLast ? "完成本组" : "下一题"}
            {autoNext ? <small className="auto-next-hint">即将自动进入</small> : null}
          </Button>
        )}
      </div>
      <p className="runner-hint">
        <Kbd>1-4</Kbd> 选择选项 · <Kbd>Enter</Kbd> {submitted ? "继续" : "提交"} · 左右滑动切题 · 提交后立即显示解析
      </p>
    </section>
  );
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <span className="runner-timer">
      <Clock aria-hidden="true" />
      <span className="timer-caption">已用</span>
      {formatDuration(elapsed)}
    </span>
  );
}
