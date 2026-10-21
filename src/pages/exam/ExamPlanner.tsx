import { useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Layers3,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Timer,
  Trash2
} from "lucide-react";
import type { ExamBlueprintItem, ExamSession, ExamTemplate } from "../../types";
import { TYPE_ORDER, typeLabel, typeTone } from "../../lib/constants";
import {
  blueprintMaxScore,
  blueprintQuestionCount,
  blueprintTotal,
  buildTemplate,
  createExamSession,
  evaluateExam,
  examRemainingMs,
  makeBlueprintItem,
  pickExamQuestions,
  runningExamSession,
  submittedExamSessions
} from "../../lib/exam";
import { formatClock, relativeTime } from "../../lib/date";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { Button, Chip, EmptyState, Field, IconButton, InlineNotice, PageHeader, SectionHead, SectionNav, TextInput } from "../../components/ui";
import { cn } from "../../lib/text";
import { makeDraft, type Draft } from "./shared";

export function ExamPlanner() {
  const { state, catalog, update, toast, confirm } = useApp();
  const [draft, setDraft] = useState<Draft>(() => makeDraft(catalog));
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const running = runningExamSession(state);
  const history = submittedExamSessions(state);
  const visibleBankIds = new Set(catalog.visibleBanks.map((bank) => bank.id));
  const visibleBlueprint = draft.blueprint.filter((item) => visibleBankIds.has(item.bankId));
  const planned = blueprintQuestionCount(visibleBlueprint);
  const maxScore = blueprintMaxScore(visibleBlueprint);
  const selectedIds = new Set(visibleBlueprint.map((item) => item.bankId));

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
    setDraft((current) => {
      if (current.blueprint.some((item) => item.bankId === bankId)) {
        return { ...current, blueprint: current.blueprint.filter((item) => item.bankId !== bankId) };
      }
      let blueprint = current.blueprint.filter((item) => item.bankId !== bankId);
      if (bank.parentId) {
        // 子库与父库互斥，避免重复计数
        blueprint = blueprint.filter((item) => item.bankId !== bank.parentId);
      } else {
        const childIds = new Set(catalog.childrenOf(bank.id).map((child) => child.id));
        blueprint = blueprint.filter((item) => !childIds.has(item.bankId));
      }
      blueprint = [...blueprint, makeBlueprintItem(catalog, bankId)];
      return { ...current, blueprint };
    });
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
      blueprint: draft.blueprint.filter((item) => catalog.bankById.has(item.bankId)),
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

  return (
    <section className="page exam-page">
      <PageHeader
        eyebrow="模拟考试"
        title="把练习，变成底气"
        subtitle="按多题库蓝图组卷，保留策略；限时作答，交卷后按题型与知识点复盘。"
        actions={
          <Button variant="ghost" icon={<RotateCcw />} onClick={resetDraft}>
            重置组卷
          </Button>
        }
      />

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

        {!planned ? <InlineNotice tone="warn">当前题量为 0，设置数量后即可保存或开始考试。</InlineNotice> : null}
      </div>

      <div className="sticky-bar">
        <div className="sticky-summary">
          <strong>
            {planned} 题 · 约 {draft.durationMinutes} 分钟
          </strong>
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
