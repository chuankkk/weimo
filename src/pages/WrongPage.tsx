import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FileDown, RotateCcw, SearchX, Sparkles, Target } from "lucide-react";
import type { WrongStatus } from "../types";
import { useApp } from "../store/AppStore";
import { buildWrongRows, wrongCounts } from "../lib/stats";
import { isDue } from "../lib/date";
import { weightedSampleQuestions } from "../lib/quiz";
import { createPracticeSession } from "../lib/session";
import { navigate } from "../lib/router";
import { updateWrongStatus } from "../store/actions";
import { useDocumentTitle } from "../lib/hooks";
import { Button, EmptyState, PageHeader, ProgressBar, SearchField, Segmented, StatCard } from "../components/ui";
import { WrongBookExport } from "../components/WrongBookExport";
import { WrongCard } from "./wrong/WrongCard";

const statusTabs: { value: WrongStatus; label: string }[] = [
  { value: "active", label: "待复习" },
  { value: "mastered", label: "已掌握" },
  { value: "ignored", label: "已忽略" }
];

export function WrongPage() {
  useDocumentTitle("错题本");
  const { state, catalog, knowledgeRates, update, toast, confirm } = useApp();
  const [status, setStatus] = useState<WrongStatus>("active");
  const [bankId, setBankId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const [exportOpen, setExportOpen] = useState(false);
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    setVisibleCount(20);
  }, [status, bankId, deferredKeyword]);

  const counts = useMemo(
    () => wrongCounts(state, catalog, bankId === "all" ? undefined : bankId),
    [state, catalog, bankId]
  );

  const rows = useMemo(() => {
    const list = buildWrongRows(state, catalog, bankId === "all" ? undefined : bankId).filter(
      (row) => row.wrong.status === status
    );
    const query = deferredKeyword.trim().toLowerCase();
    const filtered = query
      ? list.filter(({ question }) =>
          [question.stem, question.knowledgePoints.join(" "), question.tags.join(" "), catalog.bankName(question.bankId)]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : list;
    return [...filtered].sort(
      (a, b) =>
        Number(isDue(b.wrong.nextReviewAt)) - Number(isDue(a.wrong.nextReviewAt)) ||
        b.wrong.lastWrongAt.localeCompare(a.wrong.lastWrongAt)
    );
  }, [state, catalog, bankId, status, deferredKeyword]);

  const visibleRows = rows.slice(0, visibleCount);

  const bankOptions = useMemo(
    () =>
      catalog.roots.flatMap((root) => [
        { id: root.id, label: root.name, depth: 0 },
        ...catalog.childrenOf(root.id).map((child) => ({ id: child.id, label: child.name, depth: 1 }))
      ]),
    [catalog]
  );

  const toggleExpanded = (questionId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const startSession = async (questionIds: string[]) => {
    if (!questionIds.length) {
      toast("当前筛选结果里没有可重刷的题目", { tone: "error" });
      return;
    }
    if (state.practiceSession && !state.practiceSession.completedAt) {
      const accepted = await confirm({
        title: "替换未完成的练习？",
        description: "当前有一组未完成的练习，开始错题重刷会替换它，已提交的记录仍会保留。",
        confirmText: "开始重刷",
        cancelText: "返回继续"
      });
      if (!accepted) return;
    }
    update((current) => ({ ...current, practiceSession: createPracticeSession(questionIds, "wrong") }));
    navigate("practice", { run: "1" });
  };

  const rematch = (ids?: string[]) => {
    if (ids) {
      void startSession(ids);
      return;
    }
    const source = rows.map((row) => row.question);
    const lastPracticedAt = new Map<string, string>();
    for (const record of state.records) lastPracticedAt.set(record.questionId, record.answeredAt);
    const rates = new Map<string, number>();
    for (const [key, value] of knowledgeRates) rates.set(key, value.rate);
    const picked = weightedSampleQuestions(source, Math.min(50, source.length), {
      wrongById: new Map(state.wrongs.map((wrong) => [wrong.questionId, wrong])),
      knowledgeRates: rates,
      lastPracticedAt,
      options: {
        wrongStrength: state.settings.weightedWrongStrength,
        knowledgeStrength: state.settings.weightedKnowledgeStrength
      }
    });
    void startSession(picked.map((question) => question.id));
  };

  const startTodayReview = () => {
    const due = buildWrongRows(state, catalog, bankId === "all" ? undefined : bankId)
      .filter((row) => row.wrong.status === "active" && isDue(row.wrong.nextReviewAt))
      .slice(0, 50);
    void startSession(due.map((row) => row.question.id));
  };

  const changeStatus = async (questionId: string, next: WrongStatus) => {
    if (next === "ignored") {
      const accepted = await confirm({
        title: "忽略这道错题？",
        description: "忽略后不再出现在待复习列表，可在“已忽略”中恢复。",
        confirmText: "忽略",
        tone: "danger"
      });
      if (!accepted) return;
    }
    update((current) => updateWrongStatus(current, questionId, next));
    toast(next === "mastered" ? "已标记为掌握" : next === "ignored" ? "已忽略该错题" : "已恢复待复习", {
      tone: "success"
    });
  };

  const totalWrong = counts.active + counts.mastered + counts.ignored;
  const completion = totalWrong ? counts.mastered / totalWrong : 0;

  return (
    <section className="page wrong-page">
      <PageHeader
        className="page-head-stack"
        eyebrow="错题本"
        title="把错处，练成底气"
        subtitle="按题库归档，结合掌握度与复习时间，集中攻克真正薄弱的地方。"
        actions={
          counts.due ? (
            <Button icon={<Sparkles />} onClick={startTodayReview}>
              今日复习 · {counts.due}
            </Button>
          ) : undefined
        }
      />

      <div className="stat-strip three">
        <StatCard label="待复习" value={counts.active} unit="题" hint={`今天到期 ${counts.due} 题`} tone="rose" icon={<Target />} />
        <StatCard label="已掌握" value={counts.mastered} unit="题" hint={`掌握率 ${Math.round(completion * 100)}%`} tone="jade" icon={<CheckCircle2 />} />
        <StatCard label="已忽略" value={counts.ignored} unit="题" hint="可随时恢复" />
      </div>

      <div className="wrong-toolbar">
        <Segmented
          ariaLabel="错题状态"
          value={status}
          onChange={(next) => setStatus(next)}
          options={statusTabs.map((tab) => ({ ...tab, badge: counts[tab.value] }))}
        />
        <div className="wrong-filters">
          <select value={bankId} onChange={(event) => setBankId(event.target.value)} aria-label="按题库筛选">
            <option value="all">全部题库</option>
            {bankOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.depth ? "　└ " : ""}
                {option.label}
              </option>
            ))}
          </select>
          <SearchField value={keyword} onChange={setKeyword} placeholder="搜索题干、知识点、标签" ariaLabel="搜索错题" />
        </div>
      </div>

      <div className="wrong-count-line">
        <span>
          {statusTabs.find((tab) => tab.value === status)?.label} · {rows.length} 题
          {totalWrong ? (
            <em>
              <ProgressBar value={completion} size="sm" tone="jade" label="错题掌握率" />
              掌握率 {Math.round(completion * 100)}%
            </em>
          ) : null}
        </span>
        <div>
          <Button variant="quiet" size="sm" icon={<FileDown />} onClick={() => setExportOpen(true)}>
            导出错题本
          </Button>
          <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => rematch()} disabled={!rows.length}>
            重刷筛选结果
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Sparkles />}
            onClick={() => navigate("practice", { mode: "wrong" })}
          >
            进入练习配置
          </Button>
        </div>
      </div>

      {rows.length ? (
        <div className="wrong-list">
          {visibleRows.map((row) => (
            <WrongCard
              key={row.question.id}
              row={row}
              expanded={expanded.has(row.question.id)}
              onToggle={() => toggleExpanded(row.question.id)}
              onRematch={() => rematch([row.question.id])}
              onStatus={(next) => void changeStatus(row.question.id, next)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={keyword ? <SearchX /> : status === "active" ? <Target /> : <Eye />}
          title={
            keyword
              ? "没有匹配的错题"
              : status === "active"
                ? "待复习列表已清空"
                : status === "mastered"
                  ? "还没有掌握记录"
                  : "还没有忽略的错题"
          }
          description={
            keyword
              ? "试试更短的关键词，或切换题库范围。"
              : status === "active"
                ? "完成练习后，答错的题会自动按题库归档到这里。"
                : "在待复习列表中标记掌握或忽略后，记录会出现在这里。"
          }
          action={
            status === "active" && !keyword ? (
              <Button icon={<Sparkles />} onClick={() => navigate("practice", { mode: "weighted" })}>
                开始一组智能练习
              </Button>
            ) : undefined
          }
        />
      )}

      {rows.length > visibleCount ? (
        <div className="load-more">
          <Button variant="ghost" block onClick={() => setVisibleCount((current) => current + 20)}>
            加载更多 · 还有 {rows.length - visibleCount} 题
          </Button>
        </div>
      ) : rows.length > 20 ? (
        <p className="load-more-done">已显示全部 {rows.length} 题</p>
      ) : null}
      <WrongBookExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        bankId={bankId === "all" ? undefined : bankId}
      />
    </section>
  );
}
