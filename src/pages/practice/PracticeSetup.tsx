import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Layers3, ListChecks, Play, RotateCcw, Sparkles } from "lucide-react";
import type { PracticeMode, QuestionType } from "../../types";
import { TYPE_ORDER, modeDescription, modeLabel, typeTone } from "../../lib/constants";
import { estimateMinutes } from "../../lib/text";
import { sampleQuestions, weightedSampleQuestions } from "../../lib/quiz";
import { createPracticeSession } from "../../lib/session";
import { navigate, useRoute } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { clearPractice } from "../../store/actions";
import { Button, EmptyState, InlineNotice, PageHeader, SectionHead, SectionNav, TypeBadge } from "../../components/ui";
import { cn } from "../../lib/text";
import { isPracticeMode, modeIcons, practiceModes } from "./shared";

export function PracticeSetup() {
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
    update((current) => ({
      ...current,
      practiceSession: createPracticeSession(
        picked.map((question) => question.id),
        mode
      )
    }));
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
        <PageHeader eyebrow="练习" title="准备开始" subtitle="先建立题库，再选择练习节奏。" />
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
      <PageHeader
        eyebrow="练习"
        title="准备开始"
        subtitle="选择练习节奏、题库范围与题型，系统会为你组织本次练习。"
      />

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
        {practiceModes.map((item) => {
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
          <span>
            预计 {estimateMinutes(planned)} 分钟 · {modeLabel[mode]}
          </span>
        </div>
        <Button icon={<Play />} onClick={() => void start()} disabled={!planned || !selectedTypes.length}>
          开始练习
        </Button>
      </div>
    </section>
  );
}
