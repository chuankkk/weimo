import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Flag,
  Layers3,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Timer,
  Trash2,
  XCircle
} from "lucide-react";
import type {
  ExamBlueprintItem,
  ExamSession,
  ExamTemplate,
  PracticeSessionState
} from "../types";
import { TYPE_ORDER, typeLabel, typeTone } from "../lib/constants";
import {
  blueprintMaxScore,
  blueprintQuestionCount,
  blueprintTotal,
  buildTemplate,
  createExamSession,
  evaluateExam,
  examRemainingMs,
  finalizeExam,
  makeBlueprintItem,
  makeDefaultBlueprint,
  pickExamQuestions,
  runningExamSession,
  submittedExamSessions
} from "../lib/exam";
import { formatClock, formatDate, formatDuration, relativeTime } from "../lib/date";
import { formatUserAnswer, formatAnswer, uid } from "../lib/text";
import { useCountdown, useDocumentTitle, useKeydown, isTypingTarget } from "../lib/hooks";
import { useRoute, navigate } from "../lib/router";
import { useApp } from "../store/AppStore";
import { updateExamSession } from "../store/actions";
import { QuestionCard } from "../components/question";
import { Modal } from "../components/overlays";
import {
  Button,
  Chip,
  DifficultyDots,
  EmptyState,
  Field,
  IconButton,
  InlineNotice,
  ProgressBar,
  ProgressRing,
  SectionHead,
  SectionNav,
  Segmented,
  StatCard,
  TextInput,
  TypeBadge
} from "../components/ui";
import { cn } from "../lib/text";

const defaultDraftName = "自定义模拟考试";

const makeDraft = (catalog: ReturnType<typeof useApp>["catalog"]) => ({
  name: defaultDraftName,
  durationMinutes: 90,
  blueprint: makeDefaultBlueprint(catalog)
});

type Draft = ReturnType<typeof makeDraft>;

export function ExamPage() {
  const route = useRoute();
  const { state } = useApp();
  const sessionId = route.params.get("session");
  const session = sessionId ? state.examSessions.find((item) => item.id === sessionId) : undefined;
  useDocumentTitle(session?.status === "running" ? "考试中" : session ? "考试报告" : "模拟考试");

  useEffect(() => {
    if (sessionId && !session) navigate("exam");
  }, [sessionId, session]);

  if (session?.status === "running") return <ExamRunner session={session} />;
  if (session) return <ExamReport session={session} />;
  return <ExamPlanner />;
}

function ExamPlanner() {
  const { state, catalog, update, toast, confirm } = useApp();
  const [draft, setDraft] = useState<Draft>(() => makeDraft(catalog));
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const running = runningExamSession(state);
  const history = submittedExamSessions(state);
  const planned = blueprintQuestionCount(draft.blueprint);
  const maxScore = blueprintMaxScore(draft.blueprint);
  const selectedIds = new Set(draft.blueprint.map((item) => item.bankId));

  const resetDraft = () => {
    setDraft(makeDraft(catalog));
    setAppliedId(null);
    toast("已重置为默认组卷");
  };

  const applyTemplate = (template: ExamTemplate) => {
    setDraft({
      name: template.name,
      durationMinutes: template.durationMinutes,
      blueprint: template.blueprint.map((item) => ({ ...item }))
    });
    setAppliedId(template.id);
    toast(`已套用「${template.name}」`, { tone: "success" });
    window.setTimeout(() => {
      document.getElementById("exam-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const toggleBank = (bankId: string) => {
    const bank = catalog.bankById.get(bankId);
    if (!bank) return;
    if (selectedIds.has(bankId)) {
      setDraft((current) => ({
        ...current,
        blueprint: current.blueprint.filter((item) => item.bankId !== bankId)
      }));
      return;
    }
    let blueprint = draft.blueprint.filter((item) => item.bankId !== bankId);
    if (bank.parentId) {
      // 子库与父库互斥，避免重复计数
      blueprint = blueprint.filter((item) => item.bankId !== bank.parentId);
    } else {
      const childIds = new Set(catalog.childrenOf(bank.id).map((child) => child.id));
      blueprint = blueprint.filter((item) => !childIds.has(item.bankId));
    }
    blueprint = [...blueprint, makeBlueprintItem(catalog, bankId)];
    setDraft({ ...draft, blueprint });
  };

  const updateCount = (bankId: string, type: keyof Omit<ExamBlueprintItem, "bankId">, value: number) => {
    const max = catalog.typeCounts(bankId)[type];
    setDraft((current) => ({
      ...current,
      blueprint: current.blueprint.map((item) =>
        item.bankId === bankId ? { ...item, [type]: Math.min(max, Math.max(0, Math.floor(value || 0))) } : item
      )
    }));
  };

  const applyPreset = (mode: "light" | "balanced" | "clear") => {
    setDraft((current) => ({
      ...current,
      blueprint: current.blueprint.map((item) => {
        if (mode === "clear") return { ...item, single: 0, multiple: 0, judge: 0, fill: 0 };
        const counts = catalog.typeCounts(item.bankId);
        const cap = mode === "light" ? { single: 3, multiple: 1, judge: 1, fill: 1 } : { single: 5, multiple: 3, judge: 3, fill: 2 };
        return {
          ...item,
          single: Math.min(cap.single, counts.single),
          multiple: Math.min(cap.multiple, counts.multiple),
          judge: Math.min(cap.judge, counts.judge),
          fill: Math.min(cap.fill, counts.fill)
        };
      })
    }));
  };

  const buildDraftTemplate = (): ExamTemplate => {
    const existing = appliedId ? state.exams.find((item) => item.id === appliedId) : undefined;
    return buildTemplate({
      id: appliedId ?? undefined,
      name: draft.name,
      durationMinutes: draft.durationMinutes,
      blueprint: draft.blueprint,
      createdAt: existing?.createdAt
    });
  };

  const persistTemplate = (template: ExamTemplate) => {
    update((current) => ({
      ...current,
      exams: current.exams.some((item) => item.id === template.id)
        ? current.exams.map((item) => (item.id === template.id ? template : item))
        : [template, ...current.exams]
    }));
    setAppliedId(template.id);
  };

  const saveDraft = (silent = false) => {
    const template = buildDraftTemplate();
    if (!template.blueprint.length) {
      toast("请先选择题库并设置抽题数量", { tone: "error" });
      return null;
    }
    persistTemplate(template);
    if (!silent) toast(`策略「${template.name}」已保存`, { tone: "success" });
    return template;
  };

  const start = (template: ExamTemplate, persist = false) => {
    const active = runningExamSession(state);
    if (active) {
      toast("已有一场进行中的考试，已为你打开", { tone: "info" });
      navigate("exam", { session: active.id });
      return;
    }
    const questions = pickExamQuestions(catalog, template);
    if (!questions.length) {
      toast("当前配置没有可抽取的题目，请检查题库范围", { tone: "error" });
      return;
    }
    const session = createExamSession(template, questions);
    update((current) => ({
      ...current,
      exams:
        persist && !current.exams.some((item) => item.id === template.id)
          ? [template, ...current.exams]
          : current.exams,
      examSessions: [...current.examSessions, session]
    }));
    navigate("exam", { session: session.id });
  };

  const startDraft = () => {
    const template = saveDraft(true);
    if (template) start(template, true);
  };

  const removeTemplate = async (template: ExamTemplate) => {
    const accepted = await confirm({
      title: `删除策略「${template.name}」？`,
      description: "只会删除这条组卷策略，历史考试记录不受影响。",
      confirmText: "删除策略",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => ({ ...current, exams: current.exams.filter((item) => item.id !== template.id) }));
    if (appliedId === template.id) setAppliedId(null);
    toast("策略已删除");
  };

  const abandonRunning = async (session: ExamSession) => {
    const accepted = await confirm({
      title: "放弃这场考试？",
      description: "本场作答不会计入成绩与错题记录，操作无法撤销。",
      confirmText: "放弃考试",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => ({ ...current, examSessions: current.examSessions.filter((item) => item.id !== session.id) }));
    toast("已放弃本场考试");
  };

  const visibleBlueprint = draft.blueprint.filter((item) => catalog.bankById.has(item.bankId));

  return (
    <section className="page exam-page">
      <div className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">模拟考试</p>
          <h1>把练习，变成底气</h1>
          <p className="page-head-sub">按多题库蓝图组卷，保留策略；限时作答，交卷后按题型与知识点复盘。</p>
        </div>
        <div className="page-head-actions">
          <Button variant="ghost" icon={<RotateCcw />} onClick={resetDraft}>
            重置组卷
          </Button>
        </div>
      </div>

      <div className="exam-hero">
        <div className="exam-hero-copy">
          <p className="eyebrow">当前组卷</p>
          <h2>
            {planned}
            <small>题</small>
          </h2>
          <p>
            {visibleBlueprint.length} 个题库范围 · {draft.durationMinutes} 分钟 · 满分 {maxScore} 分
          </p>
        </div>
        <div className="exam-hero-actions">
          <Button size="lg" icon={<Play />} onClick={startDraft} disabled={!planned}>
            开始考试
          </Button>
          <Button variant="ghost" size="lg" onClick={() => saveDraft()} disabled={!planned}>
            仅保存策略
          </Button>
        </div>
        <span className="exam-seal" aria-hidden="true">
          闱
        </span>
      </div>

      {running ? (
        <div className="resume-card exam-resume">
          <span className="resume-mark" aria-hidden="true">
            <Timer />
          </span>
          <div>
            <strong>{running.name} 进行中</strong>
            <p>
              已答 {Object.values(running.answers).filter((answer) => answer.some(Boolean)).length} /{" "}
              {running.questionIds.length} 题 · 剩余 {formatClock(examRemainingMs(running))}
            </p>
          </div>
          <div className="resume-actions">
            <Button variant="ghost" size="sm" onClick={() => void abandonRunning(running)}>
              放弃
            </Button>
            <Button size="sm" icon={<Play />} onClick={() => navigate("exam", { session: running.id })}>
              继续考试
            </Button>
          </div>
        </div>
      ) : null}

      <SectionNav
        items={[
          { id: "exam-strategies", label: "策略库" },
          { id: "exam-editor", label: "组卷设置" },
          { id: "exam-history", label: "考试记录" }
        ]}
      />

      <SectionHead
        id="exam-strategies"
        icon={<ClipboardCheck />}
        title="策略库"
        hint={`${state.exams.length} 套可复用组卷`}
      />
      {state.exams.length ? (
        <div className="strategy-grid">
          {state.exams.map((template) => {
            const total = blueprintQuestionCount(template.blueprint);
            const banks = template.blueprint
              .map((item) => catalog.bankPath(item.bankId).map((bank) => bank.name).join(" / "))
              .filter((name, index, list) => list.indexOf(name) === index);
            return (
              <article className="strategy-card" key={template.id}>
                <div className="strategy-head">
                  <div>
                    <strong>{template.name}</strong>
                    <p>
                      {template.durationMinutes} 分钟 · {total} 题 · {banks.length} 个范围
                    </p>
                  </div>
                  <span className="strategy-score">
                    {total}
                    <small>题</small>
                  </span>
                </div>
                <div className="strategy-banks">
                  {banks.slice(0, 4).map((name) => (
                    <Chip key={name}>{name}</Chip>
                  ))}
                  {banks.length > 4 ? <Chip>+{banks.length - 4}</Chip> : null}
                </div>
                <div className="strategy-actions">
                  <Button variant="ghost" size="sm" icon={<Save />} onClick={() => applyTemplate(template)}>
                    套用
                  </Button>
                  <Button size="sm" icon={<Play />} onClick={() => start(template)}>
                    直接开始
                  </Button>
                  <IconButton label="删除策略" size="sm" variant="plain" onClick={() => void removeTemplate(template)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardCheck />}
          title="还没有保存的策略"
          description="在下方设置题库范围和题型数量，保存后即可一键复用。"
        />
      )}

      <div id="exam-editor" className="exam-editor">
        <SectionHead icon={<Sparkles />} title="组卷设置" hint={appliedId ? "正在编辑已保存的策略" : "保存后会出现在策略库"} />

        <div className="card editor-basics">
          <div className="editor-grid two">
            <Field label="策略名称">
              <TextInput
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：行测全真模拟"
              />
            </Field>
            <Field label="考试时长" hint="分钟">
              <TextInput
                type="number"
                min={1}
                max={600}
                value={draft.durationMinutes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    durationMinutes: Math.min(600, Math.max(1, Number(event.target.value) || 1))
                  }))
                }
              />
            </Field>
          </div>
        </div>

        <SectionHead icon={<Layers3 />} title="组卷范围" hint="父题库与子题库互斥，避免重复抽题" />
        {catalog.roots.length ? (
          <div className="exam-bank-picker">
            {catalog.roots.map((bank) => {
              const children = catalog.childrenOf(bank.id);
              const selected = selectedIds.has(bank.id);
              const counts = catalog.typeCounts(bank.id);
              return (
                <article className={cn("exam-bank-card", selected && "is-selected")} key={bank.id}>
                  <button type="button" className="exam-bank-main" onClick={() => toggleBank(bank.id)} aria-pressed={selected}>
                    <span className={cn("pick-check", selected && "is-on")}>{selected ? <Check /> : null}</span>
                    <span className="bank-spine" style={{ background: bank.color }} aria-hidden="true" />
                    <span className="exam-bank-copy">
                      <strong>{bank.name}</strong>
                      <small>
                        {catalog.totalIn(bank.id)} 题 · {children.length} 个子库 · 单选 {counts.single} / 多选 {counts.multiple} / 判断{" "}
                        {counts.judge} / 填空 {counts.fill}
                      </small>
                    </span>
                    {selected ? <span className="exam-selected">已加入</span> : <Plus aria-hidden="true" />}
                  </button>
                  {children.length ? (
                    <div className="exam-bank-children">
                      {children.map((child) => (
                        <button
                          type="button"
                          key={child.id}
                          className={cn("child-chip", selectedIds.has(child.id) && "is-active")}
                          onClick={() => toggleBank(child.id)}
                          aria-pressed={selectedIds.has(child.id)}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Layers3 />} title="还没有题库" description="先创建或导入题库，才能组卷。" action={<Button onClick={() => navigate("banks")}>去题库页</Button>} />
        )}

        <div className="preset-bar">
          <Button variant="ghost" size="sm" onClick={() => applyPreset("light")} disabled={!visibleBlueprint.length}>
            少量练手
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyPreset("balanced")} disabled={!visibleBlueprint.length}>
            均衡模拟
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyPreset("clear")} disabled={!visibleBlueprint.length}>
            清空题数
          </Button>
          <span>快捷调整所有范围的抽题数量</span>
        </div>

        <SectionHead icon={<ListChecks />} title="题型数量" hint="题量不足时会取该范围内的全部题目" />
        {visibleBlueprint.length ? (
          <div className="blueprint-list">
            {visibleBlueprint.map((item) => {
              const bank = catalog.bankById.get(item.bankId);
              if (!bank) return null;
              const counts = catalog.typeCounts(item.bankId);
              return (
                <article className="blueprint-row" key={item.bankId}>
                  <div className="blueprint-head">
                    <div>
                      <strong>{catalog.bankPath(item.bankId).map((bank) => bank.name).join(" / ")}</strong>
                      <small>
                        {catalog.totalIn(item.bankId)} 题可抽 · 本范围 {blueprintTotal(item)} 题
                      </small>
                    </div>
                    <IconButton label="从组卷中移除" size="sm" variant="plain" onClick={() => toggleBank(item.bankId)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                  <div className="blueprint-counts">
                    {TYPE_ORDER.map((type) => (
                      <label key={type} className={cn("blueprint-count", `tone-border-${typeTone[type]}`)}>
                        <span>
                          {typeLabel[type]}
                          <small>上限 {counts[type]}</small>
                        </span>
                        <div>
                          <button
                            type="button"
                            onClick={() => updateCount(item.bankId, type, item[type] - 1)}
                            disabled={item[type] <= 0}
                            aria-label={`减少${typeLabel[type]}数量`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={counts[type]}
                            value={item[type]}
                            onChange={(event) => updateCount(item.bankId, type, Number(event.target.value))}
                            aria-label={`${typeLabel[type]}数量`}
                          />
                          <button
                            type="button"
                            onClick={() => updateCount(item.bankId, type, item[type] + 1)}
                            disabled={item[type] >= counts[type]}
                            aria-label={`增加${typeLabel[type]}数量`}
                          >
                            +
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<ListChecks />} title="先选择题库范围" description="可以同时选择多个一级题库或子题库，再为每个范围设置题型数量。" />
        )}

        {!planned ? (
          <InlineNotice tone="warn">当前题量为 0，设置数量后即可保存或开始考试。</InlineNotice>
        ) : null}
      </div>

      <div className="sticky-bar">
        <div className="sticky-summary">
          <strong>{planned} 题 · 约 {draft.durationMinutes} 分钟</strong>
          <span>{visibleBlueprint.length} 个题库范围</span>
        </div>
        <Button icon={<Play />} onClick={startDraft} disabled={!planned}>
          保存并开始
        </Button>
      </div>

      <SectionHead id="exam-history" icon={<Clock />} title="考试记录" hint="交卷后可随时回看报告" />
      {history.length ? (
        <div className="history-list card">
          {history.slice(0, 6).map((session) => {
            const template = state.exams.find((item) => item.id === session.templateId);
            const result = evaluateExam(session, catalog, template);
            return (
              <button
                type="button"
                className="history-row"
                key={session.id}
                onClick={() => navigate("exam", { session: session.id })}
              >
                <span className={cn("history-mark", session.status === "timeout" ? "is-timeout" : "is-done")}>
                  {session.status === "timeout" ? "超时" : "已交"}
                </span>
                <span className="history-copy">
                  <strong>{session.name}</strong>
                  <small>
                    {session.submittedAt ? relativeTime(session.submittedAt) : ""} · {result.correct}/{result.total} 题正确
                  </small>
                </span>
                <span className="history-score">
                  <b>{result.score}</b>
                  <small>/ {result.maxScore} 分</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted-line">完成第一场模拟考试后，报告会保存在这里。</p>
      )}
    </section>
  );
}

function ExamRunner({ session }: { session: ExamSession }) {
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
    update((current) =>
      updateExamSession(current, session.id, (item) => ({ ...item, currentIndex: clamped }))
    );
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
        <div>
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

function ExamReport({ session }: { session: ExamSession }) {
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
    const startedAt = new Date().toISOString();
    const next: PracticeSessionState = {
      id: uid("practice"),
      mode: "wrong",
      questionIds: wrongRows.slice(0, 50).map((row) => row.question.id),
      currentIndex: 0,
      answers: {},
      submitted: {},
      startedAt,
      questionStartedAt: startedAt
    };
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
            const order = result.rows.findIndex((item) => item.question.id === row.question.id) + 1;
            return (
              <article className={cn("review-row report-row", row.isCorrect ? "is-correct" : "is-wrong")} key={row.question.id}>
                <button type="button" className="report-row-main" onClick={() => toggle(row.question.id)} aria-expanded={isOpen}>
                  <span className={cn("review-index", row.isCorrect ? "is-correct" : "is-wrong")}>{String(order).padStart(2, "0")}</span>
                  <span className="review-mark" aria-hidden="true">
                    {row.isCorrect ? <Check /> : <XCircle />}
                  </span>
                  <span className="review-copy">
                    <p>{row.question.stem}</p>
                    <span>
                      <TypeBadge type={row.question.type} />
                      <DifficultyDots value={row.question.difficulty} />
                      {row.answer.some(Boolean) ? `你的答案：${formatUserAnswer(row.question, row.answer)}` : "未作答"}
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
                        {row.answer.some(Boolean) ? formatUserAnswer(row.question, row.answer) : "未作答"}
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
