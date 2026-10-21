import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Layers3,
  ListChecks,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  XCircle
} from "lucide-react";
import type { PracticeMode, PracticeSessionState, QuestionType } from "../types";
import { TYPE_ORDER, modeDescription, modeLabel, typeTone } from "../lib/constants";
import { estimateMinutes, formatAnswer, uid } from "../lib/text";
import { nowIso, formatDuration } from "../lib/date";
import { evaluateQuestion, sampleQuestions, weightedSampleQuestions } from "../lib/quiz";
import { sessionSummary } from "../lib/stats";
import { useDocumentTitle, isTypingTarget, useElapsed, useKeydown } from "../lib/hooks";
import { useRoute, navigate } from "../lib/router";
import { useApp } from "../store/AppStore";
import { applyPracticeAnswer, clearPractice } from "../store/actions";
import { QuestionCard, AnswerPanel, NoteEditor } from "../components/question";
import {
  Button,
  EmptyState,
  IconButton,
  InlineNotice,
  ProgressBar,
  ProgressRing,
  SectionHead,
  SectionNav,
  TypeBadge
} from "../components/ui";
import { cn } from "../lib/text";

const modeIcons: Record<PracticeMode, typeof BookOpen> = {
  sequence: BookOpen,
  random: Shuffle,
  weighted: Brain,
  wrong: RotateCcw
};

const isPracticeMode = (value: string | null): value is PracticeMode =>
  value === "sequence" || value === "random" || value === "weighted" || value === "wrong";

export function PracticePage() {
  const route = useRoute();
  const { state } = useApp();
  const session = state.practiceSession;
  const run = route.params.get("run") === "1";
  const showRunner = Boolean(run && session && !session.completedAt);
  const showSummary = Boolean(run && session?.completedAt);
  useDocumentTitle(showRunner ? "练习中" : showSummary ? "练习完成" : "练习");

  if (showRunner && session) return <PracticeRunner session={session} />;
  if (showSummary && session) return <PracticeSummary session={session} />;
  return <PracticeSetup />;
}

function PracticeSetup() {
  const { state, catalog, knowledgeRates, toast, update, confirm } = useApp();
  const route = useRoute();
  const routeMode = route.params.get("mode");
  const [mode, setMode] = useState<PracticeMode>(isPracticeMode(routeMode) ? routeMode : "sequence");
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>(catalog.roots[0] ? [catalog.roots[0].id] : []);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(TYPE_ORDER);
  const [count, setCount] = useState(20);
  const existing = state.practiceSession && !state.practiceSession.completedAt ? state.practiceSession : null;

  useEffect(() => {
    if (isPracticeMode(routeMode)) setMode(routeMode);
  }, [routeMode]);

  useEffect(() => {
    const valid = selectedBankIds.filter((id) => catalog.bankById.has(id));
    if (valid.length !== selectedBankIds.length) setSelectedBankIds(valid);
  }, [catalog, selectedBankIds]);

  const pool = useMemo(() => {
    const map = new Map<string, (typeof catalog.questions)[number]>();
    for (const bankId of selectedBankIds) {
      for (const question of catalog.pool(bankId)) map.set(question.id, question);
    }
    return [...map.values()];
  }, [catalog, selectedBankIds]);

  const typeCounts = useMemo(() => {
    const counts: Record<QuestionType, number> = { single: 0, multiple: 0, judge: 0, fill: 0 };
    for (const question of pool) counts[question.type] += 1;
    return counts;
  }, [pool]);

  const available = useMemo(() => {
    const typed = pool.filter((question) => selectedTypes.includes(question.type));
    if (mode !== "wrong") return typed;
    const wrongIds = new Set(state.wrongs.filter((wrong) => wrong.status === "active").map((wrong) => wrong.questionId));
    return typed.filter((question) => wrongIds.has(question.id));
  }, [mode, pool, selectedTypes, state.wrongs]);

  const planned = Math.min(count, available.length);

  const toggleBank = (bankId: string) => {
    setSelectedBankIds((current) =>
      current.includes(bankId) ? current.filter((id) => id !== bankId) : [...current, bankId]
    );
  };

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  };

  const start = async () => {
    if (!available.length) {
      toast(mode === "wrong" ? "所选范围暂无活跃错题" : "请先选择题库和题型", { tone: "error" });
      return;
    }
    if (!selectedTypes.length) {
      toast("至少选择一种题型", { tone: "error" });
      return;
    }
    if (existing) {
      const accepted = await confirm({
        title: "开始新的练习？",
        description: "当前有一组未完成的练习。开始新练习会替换它，已提交的作答记录仍会保留在统计中。",
        confirmText: "开始新练习",
        cancelText: "返回继续"
      });
      if (!accepted) return;
    }
    let picked = available;
    if (mode === "sequence") {
      picked = [...available]
        .sort((a, b) => a.sortIndex - b.sortIndex || a.createdAt.localeCompare(b.createdAt))
        .slice(0, count);
    } else if (mode === "random") {
      picked = sampleQuestions(available, count);
    } else {
      const lastPracticedAt = new Map<string, string>();
      for (const record of state.records) lastPracticedAt.set(record.questionId, record.answeredAt);
      const rates = new Map<string, number>();
      for (const [key, value] of knowledgeRates) rates.set(key, value.rate);
      picked = weightedSampleQuestions(available, count, {
        wrongById: new Map(state.wrongs.map((wrong) => [wrong.questionId, wrong])),
        knowledgeRates: rates,
        lastPracticedAt,
        options: {
          wrongStrength: state.settings.weightedWrongStrength,
          knowledgeStrength: state.settings.weightedKnowledgeStrength
        }
      });
    }
    const startedAt = nowIso();
    const session: PracticeSessionState = {
      id: uid("practice"),
      mode,
      questionIds: picked.map((question) => question.id),
      currentIndex: 0,
      answers: {},
      submitted: {},
      startedAt,
      questionStartedAt: startedAt
    };
    update((current) => ({ ...current, practiceSession: session }));
    navigate("practice", { run: "1" });
  };

  const discard = async () => {
    const accepted = await confirm({
      title: "放弃本次练习？",
      description: "已作答的记录会保留在统计中，但当前进度将被清除。",
      confirmText: "放弃练习",
      tone: "danger"
    });
    if (accepted) {
      update(clearPractice);
      toast("已清除未完成的练习");
    }
  };

  if (!catalog.roots.length) {
    return (
      <section className="page">
        <div className="page-head">
          <div className="page-head-copy">
            <p className="eyebrow">练习</p>
            <h1>准备开始</h1>
            <p className="page-head-sub">先建立题库，再选择练习节奏。</p>
          </div>
        </div>
        <EmptyState
          icon={<BookOpen />}
          title="还没有可练习的题库"
          description="导入题库后，就可以按顺序、随机或智能加权开始练习。"
          action={<Button onClick={() => navigate("banks")}>去题库页</Button>}
        />
      </section>
    );
  }

  return (
    <section className="page practice-setup-page">
      <div className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">练习</p>
          <h1>准备开始</h1>
          <p className="page-head-sub">选择练习节奏、题库范围与题型，系统会为你组织本次练习。</p>
        </div>
      </div>

      <SectionNav
        items={[
          { id: "practice-mode", label: "练习模式" },
          { id: "practice-range", label: "抽题范围" },
          { id: "practice-types", label: "题型与数量" }
        ]}
      />

      {existing ? (
        <div className="resume-card">
          <span className="resume-mark" aria-hidden="true">
            <RotateCcw />
          </span>
          <div>
            <strong>有一组未完成的练习</strong>
            <p>
              {modeLabel[existing.mode]} · 第 {existing.currentIndex + 1} / {existing.questionIds.length} 题 · 开始于{" "}
              {new Date(existing.startedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="resume-actions">
            <Button variant="ghost" size="sm" onClick={() => void discard()}>
              放弃
            </Button>
            <Button size="sm" icon={<Play />} onClick={() => navigate("practice", { run: "1" })}>
              继续练习
            </Button>
          </div>
        </div>
      ) : null}

      <SectionHead id="practice-mode" icon={<Sparkles />} title="练习模式" hint="不同节奏适合不同阶段" />
      <div className="mode-grid">
        {(["sequence", "random", "weighted", "wrong"] as PracticeMode[]).map((item) => {
          const Icon = modeIcons[item];
          return (
            <button
              key={item}
              type="button"
              className={cn("mode-card", mode === item && "is-active")}
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
            >
              <span className="mode-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="mode-copy">
                <strong>{modeLabel[item]}</strong>
                <small>{modeDescription[item]}</small>
              </span>
              {mode === item ? (
                <span className="mode-check" aria-hidden="true">
                  <Check />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <SectionHead
        id="practice-range"
        icon={<Layers3 />}
        title="抽题范围"
        hint="可同时选择多个题库或子库"
        action={
          <div className="inline-actions">
            <Button variant="quiet" size="sm" onClick={() => setSelectedBankIds(catalog.roots.map((bank) => bank.id))}>
              全选
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setSelectedBankIds([])}>
              清空
            </Button>
          </div>
        }
      />
      <div className="bank-picker">
        {catalog.roots.map((bank) => {
          const children = catalog.childrenOf(bank.id);
          const selected = selectedBankIds.includes(bank.id);
          const total = catalog.pool(bank.id).filter((question) => selectedTypes.includes(question.type)).length;
          return (
            <article className={cn("bank-pick", selected && "is-selected")} key={bank.id}>
              <button type="button" className="bank-pick-main" onClick={() => toggleBank(bank.id)} aria-pressed={selected}>
                <span className={cn("pick-check", selected && "is-on")}>{selected ? <Check /> : null}</span>
                <span className="bank-spine" style={{ background: bank.color }} aria-hidden="true" />
                <span className="bank-pick-copy">
                  <strong>{bank.name}</strong>
                  <small>
                    {total} 题可选 · {children.length} 个子库
                  </small>
                </span>
              </button>
              {children.length ? (
                <div className="bank-pick-children">
                  {children.map((child) => {
                    const childSelected = selectedBankIds.includes(child.id);
                    const childTotal = catalog
                      .pool(child.id)
                      .filter((question) => selectedTypes.includes(question.type)).length;
                    return (
                      <button
                        type="button"
                        key={child.id}
                        className={cn("child-chip", childSelected && "is-active")}
                        onClick={() => toggleBank(child.id)}
                        aria-pressed={childSelected}
                      >
                        {child.name}
                        <b>{childTotal}</b>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <SectionHead id="practice-types" icon={<ListChecks />} title="题型与数量" hint="未选中的题型不会出现在本次练习中" />
      <div className="setup-card card">
        <div className="type-toggle-grid">
          {TYPE_ORDER.map((type) => (
            <button
              type="button"
              key={type}
              className={cn("type-toggle", selectedTypes.includes(type) && "is-active", `tone-border-${typeTone[type]}`)}
              onClick={() => toggleType(type)}
              aria-pressed={selectedTypes.includes(type)}
            >
              <TypeBadge type={type} count={typeCounts[type]} />
              <small>{selectedTypes.includes(type) ? "已加入" : "未选择"}</small>
              {selectedTypes.includes(type) ? (
                <span className="type-toggle-check" aria-hidden="true">
                  <Check />
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="count-row">
          <div>
            <strong>抽取数量</strong>
            <small>本次可用 {available.length} 题</small>
          </div>
          <div className="count-control">
            <div className="count-presets">
              {[10, 20, 30, 50].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={cn(count === preset && "is-active")}
                  onClick={() => setCount(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(event) => setCount(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}
              aria-label="抽取题目数量"
            />
          </div>
        </div>

        {mode === "wrong" && !available.length ? (
          <InlineNotice tone="warn">当前范围内没有活跃错题，完成几次练习后错题会自动进入这里。</InlineNotice>
        ) : null}
      </div>

      <div className="sticky-bar">
        <div className="sticky-summary">
          <strong>本次 {planned} 题</strong>
          <span>预计 {estimateMinutes(planned)} 分钟 · {modeLabel[mode]}</span>
        </div>
        <Button icon={<Play />} onClick={start} disabled={!planned || !selectedTypes.length}>
          开始练习
        </Button>
      </div>
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

function PracticeRunner({ session }: { session: PracticeSessionState }) {
  const { state, catalog, update, toast, confirm } = useApp();
  const question = catalog.questionById.get(session.questionIds[session.currentIndex]);
  const [autoNext, setAutoNext] = useState(false);
  const autoTimer = useRef<number | null>(null);

  const answer = question ? session.answers[question.id] ?? [] : [];
  const submitted = question ? Boolean(session.submitted[question.id]) : false;
  const evaluation = question && submitted ? evaluateQuestion(question, answer) : null;
  const answeredCount = Object.keys(session.submitted).length;
  const total = session.questionIds.length;
  const isLast = session.currentIndex >= total - 1;

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
    <section className="page runner-page">
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
        <ProgressBar value={(session.currentIndex + (submitted ? 1 : 0)) / total} label="练习进度" />
        <div>
          <span>{Math.round(((session.currentIndex + (submitted ? 1 : 0)) / total) * 100)}%</span>
          <span>
            {question.type === "single" ? "单选" : question.type === "multiple" ? "多选" : question.type === "judge" ? "判断" : "填空"}
          </span>
        </div>
      </div>

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

      <div className="runner-actions">
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
          <Button className="runner-primary" icon={isLast ? <CheckCircle2 /> : <ArrowRight />} onClick={goNext}>
            {isLast ? "完成本组" : "下一题"}
            {autoNext ? <small className="auto-next-hint">即将自动进入</small> : null}
          </Button>
        )}
      </div>
      <p className="runner-hint">
        快捷键：数字选择选项 · Enter {submitted ? "继续" : "提交"} · 提交后立即显示解析
      </p>
    </section>
  );
}

function PracticeSummary({ session }: { session: PracticeSessionState }) {
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
    const startedAt = nowIso();
    const next: PracticeSessionState = {
      id: uid("practice"),
      mode: "wrong",
      questionIds: wrongRecords.slice(0, 50).map((record) => record.questionId),
      currentIndex: 0,
      answers: {},
      submitted: {},
      startedAt,
      questionStartedAt: startedAt
    };
    update((current) => ({ ...current, practiceSession: next }));
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
        <Button variant="ghost" icon={<ArrowLeft />} onClick={() => exitToSetup()}>
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
